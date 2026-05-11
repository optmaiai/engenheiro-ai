import { z } from "zod";
import { AGENT_IDS } from "./agents";

export const agentIdSchema = z.enum(AGENT_IDS);

export const routingSchema = z.object({
  handoff_to: z.array(agentIdSchema).default([]),
  reason: z.string().min(3),
  confidence: z.number().min(0).max(1)
});

export const chatRequestSchema = z.object({
  conversation_id: z.string().uuid().optional(),
  agent_id: agentIdSchema.default("comunicacao"),
  message: z.string().min(1).max(12000),
  stream: z.boolean().default(false),
  metadata: z.record(z.unknown()).default({})
});

export const createConversationSchema = z.object({
  agent_id: agentIdSchema.default("comunicacao"),
  title: z.string().min(1).max(140).default("Nova conversa"),
  metadata: z.record(z.unknown()).default({})
});

export const feedbackRequestSchema = z.object({
  message_id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  agent_id: agentIdSchema,
  rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  notes: z.string().max(2000).optional(),
  corrections: z.string().max(4000).optional()
});

export const orcamentoOutputSchema = z.object({
  premissas: z.array(z.string()),
  cenarios: z.object({
    rapido: z.number().nonnegative(),
    normal: z.number().nonnegative(),
    premium: z.number().nonnegative()
  }),
  impostos_estimados_pct: z.number().min(0).max(100),
  riscos: z.array(z.string()),
  recomendacao: z.string()
});

export const structuredOutputSchemas = {
  orcamento: orcamentoOutputSchema
} as const;
