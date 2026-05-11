/**
 * Metrics collection and dashboard queries
 * Observability for AI agent system performance
 */

import { createServiceClient } from "./supabase";

function getSupabase() {
  return createServiceClient();
}

// ========================================================================
// METRIC RECORDING HELPERS
// ========================================================================

export interface MetricSnapshot {
  timestamp: Date;
  agent_id: string;
  event_type: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Record request started
 */
export async function recordRequestStart(
  conversationId: string,
  userId: string,
  agentId: string,
  model: string
) {
  const { error } = await getSupabase().from("ai_metrics").insert([
    {
      event_type: "request_started",
      agent_id: agentId,
      model,
      conversation_id: conversationId,
      user_id: userId,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) console.error("Failed to record request start:", error);
}

/**
 * Record request completed
 */
export async function recordRequestComplete(
  conversationId: string,
  userId: string,
  agentId: string,
  model: string,
  latencyMs: number,
  tokensIn: number,
  tokensOut: number,
  costUsd: number
) {
  const { error } = await getSupabase().from("ai_metrics").insert([
    {
      event_type: "request_completed",
      agent_id: agentId,
      model,
      conversation_id: conversationId,
      user_id: userId,
      latency_ms: latencyMs,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) console.error("Failed to record request complete:", error);
}

/**
 * Record request failed
 */
export async function recordRequestFailed(
  conversationId: string,
  agentId: string,
  model: string,
  errorClass: string,
  errorMessage: string,
  retryCount: number = 0
) {
  const { error } = await getSupabase().from("ai_metrics").insert([
    {
      event_type: "request_failed",
      agent_id: agentId,
      model,
      conversation_id: conversationId,
      error_class: errorClass,
      error_message: errorMessage,
      retry_count: retryCount,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) console.error("Failed to record request failure:", error);
}

/**
 * Record routing emission
 */
export async function recordRoutingEmitted(
  conversationId: string,
  userId: string,
  fromAgent: string,
  toAgent: string,
  confidence: number
) {
  const { error } = await getSupabase().from("ai_metrics").insert([
    {
      event_type: "routing_emitted",
      from_agent: fromAgent,
      to_agent: toAgent,
      routing_confidence: confidence,
      conversation_id: conversationId,
      user_id: userId,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) console.error("Failed to record routing emitted:", error);
}

/**
 * Record routing followed (user clicked handoff)
 */
export async function recordRoutingFollowed(
  conversationId: string,
  userId: string,
  fromAgent: string,
  toAgent: string
) {
  const { error } = await getSupabase().from("ai_metrics").insert([
    {
      event_type: "routing_followed",
      from_agent: fromAgent,
      to_agent: toAgent,
      user_accepted: true,
      conversation_id: conversationId,
      user_id: userId,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) console.error("Failed to record routing followed:", error);
}

/**
 * Record guardrail trigger
 */
export async function recordGuardrailTriggered(
  conversationId: string,
  userId: string,
  guardName: string,
  guardAction: string,
  agentId?: string
) {
  const { error } = await getSupabase().from("ai_metrics").insert([
    {
      event_type: "guardrail_triggered",
      agent_id: agentId,
      guard_name: guardName,
      guard_action: guardAction,
      conversation_id: conversationId,
      user_id: userId,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) console.error("Failed to record guardrail trigger:", error);
}

// ========================================================================
// DASHBOARD QUERIES
// ========================================================================

export interface DashboardMetrics {
  period: string;
  requests_total: number;
  requests_failed: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_cost_per_request: number;
  agents: AgentMetrics[];
  routing_acceptance_rate: number;
  top_guardrails_triggered: Array<{ name: string; count: number }>;
}

export interface AgentMetrics {
  agent_id: string;
  requests: number;
  avg_latency_ms: number;
  success_rate_pct: number;
  total_cost_usd: number;
  feedback_positive_pct?: number;
  feedback_negative_pct?: number;
}

/**
 * Get dashboard metrics for admin
 */
export async function getDashboardMetrics(
  daysBack: number = 7
): Promise<DashboardMetrics | null> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const supabase = getSupabase();

  // Completed requests
  const { data: completedRequests } = await supabase
    .from("ai_metrics")
    .select(
      "agent_id, latency_ms, tokens_in, tokens_out, cost_usd, created_at"
    )
    .eq("event_type", "request_completed")
    .gte("created_at", startDate.toISOString());

  // Failed requests
  const { data: failedRequests } = await supabase
    .from("ai_metrics")
    .select("*")
    .eq("event_type", "request_failed")
    .gte("created_at", startDate.toISOString());

  // Routing emissions
  const { data: routingEmitted } = await supabase
    .from("ai_metrics")
    .select("*")
    .eq("event_type", "routing_emitted")
    .gte("created_at", startDate.toISOString());

  // Routing followed
  const { data: routingFollowed } = await supabase
    .from("ai_metrics")
    .select("*")
    .eq("event_type", "routing_followed")
    .gte("created_at", startDate.toISOString());

  // Guardrail triggers
  const { data: guardrailTriggered } = await supabase
    .from("ai_metrics")
    .select("guard_name")
    .eq("event_type", "guardrail_triggered")
    .gte("created_at", startDate.toISOString());

  if (
    !completedRequests ||
    completedRequests.length === 0
  ) {
    return null;
  }

  // Aggregate
  const totalRequests = (completedRequests?.length || 0) +
    (failedRequests?.length || 0);
  const totalTokens = (completedRequests || []).reduce(
    (sum: number, r: Record<string, unknown>) => sum + ((r.tokens_in as number) || 0) + ((r.tokens_out as number) || 0),
    0
  );
  const totalCost = (completedRequests || []).reduce(
    (sum: number, r: Record<string, unknown>) => sum + ((r.cost_usd as number) || 0),
    0
  );

  const latencies = (completedRequests || [])
    .map((r: Record<string, unknown>) => r.latency_ms as number)
    .sort((a: number, b: number) => a - b);
  const avgLatency =
    latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length;
  const p50Latency = latencies[Math.floor(latencies.length * 0.5)];
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)];

  // Per-agent breakdown
  const agentMap = new Map<string, AgentMetrics>();
  for (const req of completedRequests || []) {
    const agentId = req.agent_id as string;
    if (!agentMap.has(agentId)) {
      agentMap.set(agentId, {
        agent_id: agentId,
        requests: 0,
        avg_latency_ms: 0,
        success_rate_pct: 0,
        total_cost_usd: 0,
      });
    }

    const metrics = agentMap.get(agentId)!;
    metrics.requests++;
    metrics.avg_latency_ms += (req.latency_ms as number) || 0;
    metrics.total_cost_usd += (req.cost_usd as number) || 0;
  }

  const agents = Array.from(agentMap.values()).map((m) => ({
    ...m,
    avg_latency_ms: m.avg_latency_ms / m.requests,
    success_rate_pct: 95, // Placeholder
  }));

  // Routing acceptance
  const routingAcceptanceRate =
    routingEmitted && routingEmitted.length > 0
      ? (((routingFollowed?.length || 0) /
          (routingEmitted?.length || 1)) *
          100)
      : 0;

  // Top guardrails
  const guardrailCounts = new Map<string, number>();
  for (const event of guardrailTriggered || []) {
    const guardName = event.guard_name as string;
    guardrailCounts.set(
      guardName,
      (guardrailCounts.get(guardName) || 0) + 1
    );
  }

  const topGuardrails = Array.from(guardrailCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    period: `Last ${daysBack} days`,
    requests_total: totalRequests,
    requests_failed: failedRequests?.length || 0,
    avg_latency_ms: avgLatency,
    p50_latency_ms: p50Latency,
    p95_latency_ms: p95Latency,
    total_tokens: totalTokens,
    total_cost_usd: totalCost,
    avg_cost_per_request: totalCost / totalRequests,
    agents,
    routing_acceptance_rate: routingAcceptanceRate,
    top_guardrails_triggered: topGuardrails,
  };
}

/**
 * Get agent-specific performance
 */
export async function getAgentPerformance(
  agentId: string,
  daysBack: number = 7
): Promise<AgentMetrics | null> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const supabase = getSupabase();

  const { data: requests } = await supabase
    .from("ai_metrics")
    .select("*")
    .eq("agent_id", agentId)
    .eq("event_type", "request_completed")
    .gte("created_at", startDate.toISOString());

  const { data: failures } = await supabase
    .from("ai_metrics")
    .select("*")
    .eq("agent_id", agentId)
    .eq("event_type", "request_failed")
    .gte("created_at", startDate.toISOString());

  const { data: feedback } = await supabase
    .from("ai_feedback")
    .select("rating")
    .eq("agent_id", agentId)
    .gte("created_at", startDate.toISOString());

  if (!requests || requests.length === 0) {
    return null;
  }

  const avgLatency = (requests as Record<string, unknown>[]).reduce(
    (sum, r) => sum + ((r.latency_ms as number) || 0),
    0
  ) / requests.length;

  const totalCost = (requests as Record<string, unknown>[]).reduce(
    (sum, r) => sum + ((r.cost_usd as number) || 0),
    0
  );

  const totalTests = (requests?.length || 0) + (failures?.length || 0);
  const successRate = totalTests > 0 ? ((requests?.length || 0) / totalTests) * 100 : 0;

  const feedbackRatings = feedback?.map((f: { rating: number }) => f.rating) || [];
  const positiveCount = feedbackRatings.filter((r: number) => r === 1).length;
  const negativeCount = feedbackRatings.filter((r: number) => r === -1).length;
  const totalFeedback = feedbackRatings.length;

  return {
    agent_id: agentId,
    requests: requests?.length || 0,
    avg_latency_ms: avgLatency,
    success_rate_pct: successRate,
    total_cost_usd: totalCost,
    feedback_positive_pct:
      totalFeedback > 0 ? (positiveCount / totalFeedback) * 100 : undefined,
    feedback_negative_pct:
      totalFeedback > 0 ? (negativeCount / totalFeedback) * 100 : undefined,
  };
}

/**
 * Get cost breakdown by model
 */
export async function getCostByModel(daysBack: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const supabase = getSupabase();

  const { data } = await supabase
    .from("ai_metrics")
    .select("model, cost_usd")
    .eq("event_type", "request_completed")
    .gte("created_at", startDate.toISOString());

  if (!data) return [];

  const costByModel = new Map<string, { count: number; total: number }>();

  for (const row of data) {
    const model = row.model as string;
    const cost = row.cost_usd as number;
    const existing = costByModel.get(model) || { count: 0, total: 0 };
    costByModel.set(model, {
      count: existing.count + 1,
      total: existing.total + cost,
    });
  }

  return Array.from(costByModel.entries()).map(([model, { count, total }]) => ({
    model,
    requests: count,
    total_cost_usd: total,
    avg_cost_per_request: total / count,
  }));
}

/**
 * Get feedback summary by agent
 */
export async function getFeedbackSummaryByAgent(daysBack: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const supabase = getSupabase();

  const { data } = await supabase
    .from("ai_feedback")
    .select("agent_id, rating")
    .gte("created_at", startDate.toISOString());

  if (!data) return [];

  const feedbackByAgent = new Map<
    string,
    { positive: number; neutral: number; negative: number; total: number }
  >();

  for (const feedback of data) {
    const agentId = feedback.agent_id;
    const rating = feedback.rating;

    if (!feedbackByAgent.has(agentId)) {
      feedbackByAgent.set(agentId, {
        positive: 0,
        neutral: 0,
        negative: 0,
        total: 0,
      });
    }

    const summary = feedbackByAgent.get(agentId)!;
    summary.total++;

    if (rating === 1) summary.positive++;
    else if (rating === 0) summary.neutral++;
    else if (rating === -1) summary.negative++;
  }

  return Array.from(feedbackByAgent.entries()).map(([agentId, summary]) => ({
    agent_id: agentId,
    positive_pct: (summary.positive / summary.total) * 100,
    neutral_pct: (summary.neutral / summary.total) * 100,
    negative_pct: (summary.negative / summary.total) * 100,
    total_feedback: summary.total,
  }));
}
