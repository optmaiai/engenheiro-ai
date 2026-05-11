import { Redis } from "@upstash/redis";
import { getAgent } from "@/lib/agents";
import { buildMessages, detectPromptInjection } from "./ai-security";
import { executeGuardrailsPipeline } from "./ai-output-guards";
import { createCompletion } from "./lovable-client";
import { createServiceClient } from "./supabase";
import {
  recordRequestComplete,
  recordRequestFailed,
  recordRequestStart,
  recordRoutingEmitted
} from "./ai-metrics";

export interface ChatInput {
  userId: string;
  conversationId?: string;
  agentId: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ChatResult {
  conversation_id: string;
  message_id: string;
  agent_id: string;
  content: string;
  routing_json: unknown;
  guardrails_triggered: unknown[];
  model: string;
  latency_ms: number;
}

function createRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function enforceRateLimit(userId: string, conversationId?: string) {
  const redis = createRedisClient();
  if (!redis) return;

  const userKey = `rate:user:${userId}`;
  const userCount = await redis.incr(userKey);
  if (userCount === 1) await redis.expire(userKey, 60);
  if (userCount > 10) throw new Error("Rate limit excedido: máximo de 10 requisições por minuto por usuário.");

  if (conversationId) {
    const conversationKey = `rate:conversation:${conversationId}`;
    const conversationCount = await redis.incr(conversationKey);
    if (conversationCount === 1) await redis.expire(conversationKey, 30);
    if (conversationCount > 3) throw new Error("Rate limit excedido: máximo de 3 requisições a cada 30 segundos por conversa.");
  }
}

function extractRouting(content: string) {
  const match = content.match(/ROUTING:\s*(\{[\s\S]*?\})/);
  if (!match) return { handoff_to: [], reason: "Sem roteamento informado", confidence: 0 };
  return JSON.parse(match[1]) as { handoff_to: string[]; reason: string; confidence: number };
}

export async function runChatCompletion(input: ChatInput): Promise<ChatResult> {
  await enforceRateLimit(input.userId, input.conversationId);

  if (detectPromptInjection(input.message)) {
    throw new Error("Mensagem bloqueada por tentativa de prompt injection ou exfiltração.");
  }

  const startedAt = Date.now();
  const supabase = createServiceClient();
  const agent = getAgent(input.agentId);

  let conversationId = input.conversationId;
  if (!conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: input.userId, agent_id: agent.id, title: input.message.slice(0, 80), metadata: input.metadata || {} })
      .select("id")
      .single();
    if (error) throw error;
    conversationId = data.id as string;
  }

  const { error: userMessageError } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    user_id: input.userId,
    agent_id: agent.id,
    role: "user",
    content: input.message
  });
  if (userMessageError) throw userMessageError;

  const [{ data: prompt }, { data: profile }, { data: history }] = await Promise.all([
    supabase.from("agent_prompts").select("content, model_override").eq("agent_id", agent.id).eq("is_active", true).maybeSingle(),
    supabase.from("user_engineer_profile").select("*").eq("user_id", input.userId).maybeSingle(),
    supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

  const model = (prompt?.model_override as string | null) || agent.defaultModel;
  await recordRequestStart(conversationId, input.userId, agent.id, model);

  try {
    const orderedHistory = ((history || []).reverse() as Array<{ role: "user" | "assistant"; content: string }>).filter(
      (message, index, all) => !(index === all.length - 1 && message.role === "user" && message.content === input.message)
    );

    const messages = buildMessages(
      {
        agentId: agent.id,
        activePrompt: prompt?.content as string | undefined,
        userProfile: profile as Record<string, unknown> | null,
        history: orderedHistory
      },
      input.message
    );

    const completion = await createCompletion(messages, model);
    const guarded = await executeGuardrailsPipeline(completion.content, agent.id, undefined, conversationId, input.userId);

    if (!guarded.passed) {
      throw new Error(`Resposta bloqueada por guardrails: ${guarded.guardrails_triggered.map((g) => g.name).join(", ")}`);
    }

    const routingJson = extractRouting(guarded.sanitized_content);
    const latencyMs = Date.now() - startedAt;

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from("ai_messages")
      .insert({
        conversation_id: conversationId,
        user_id: input.userId,
        agent_id: agent.id,
        role: "assistant",
        model: completion.model,
        content: guarded.sanitized_content,
        routing_json: routingJson,
        tokens_in: completion.tokensIn,
        tokens_out: completion.tokensOut,
        latency_ms: latencyMs,
        cost_usd: completion.costUsd
      })
      .select("id")
      .single();
    if (assistantMessageError) throw assistantMessageError;

    await recordRequestComplete(
      conversationId,
      input.userId,
      agent.id,
      completion.model,
      latencyMs,
      completion.tokensIn,
      completion.tokensOut,
      completion.costUsd
    );

    for (const toAgent of routingJson.handoff_to || []) {
      await recordRoutingEmitted(conversationId, input.userId, agent.id, toAgent, routingJson.confidence || 0);
    }

    return {
      conversation_id: conversationId,
      message_id: assistantMessage.id as string,
      agent_id: agent.id,
      content: guarded.sanitized_content,
      routing_json: routingJson,
      guardrails_triggered: guarded.guardrails_triggered,
      model: completion.model,
      latency_ms: latencyMs
    };
  } catch (error) {
    await recordRequestFailed(
      conversationId,
      agent.id,
      model,
      error instanceof Error ? error.name : "UnknownError",
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}
