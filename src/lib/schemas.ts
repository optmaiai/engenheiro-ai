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


export const updateConversationSchema = z.object({
  title: z.string().min(1).max(140).optional(),
  status: z.enum(["active", "archived", "deleted"]).optional(),
  agent_id: agentIdSchema.optional(),
  metadata: z.record(z.unknown()).optional()
});

export const engineerProfileSchema = z.object({
  crea_uf: z.string().length(2).toUpperCase().optional().nullable(),
  crea_numero: z.string().min(1).max(20).optional().nullable(),
  especialidades: z.array(z.string().min(1).max(80)).max(20).default([]),
  regime_tributario: z.string().min(1).max(50).default("simples_nacional"),
  faixa_simples: z.string().max(20).optional().nullable(),
  bdi_padrao_pct: z.number().min(0).max(100).optional().nullable(),
  hora_tecnica_brl: z.number().min(0).max(100000).optional().nullable(),
  cidade: z.string().max(120).optional().nullable(),
  estado: z.string().length(2).toUpperCase().optional().nullable(),
  preferencias_normativas: z.array(z.string().min(1).max(80)).max(30).default([]),
  estilo_comunicacao: z.string().min(1).max(50).default("tecnico_cordial")
});

export const upsertEngineerProfileSchema = engineerProfileSchema.partial();


export const createAgentPromptSchema = z.object({
  agent_id: agentIdSchema,
  title: z.string().min(1).max(160),
  content: z.string().min(50).max(50000),
  notes: z.string().max(4000).optional().nullable(),
  is_active: z.boolean().default(false),
  model_override: z.string().min(1).max(100).optional().nullable()
});

export const updateAgentPromptSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  content: z.string().min(50).max(50000).optional(),
  notes: z.string().max(4000).optional().nullable(),
  is_active: z.boolean().optional(),
  model_override: z.string().min(1).max(100).optional().nullable()
}).refine((value) => Object.keys(value).length > 0, {
  message: "Informe pelo menos um campo para atualizar"
});


export const ingestAttachmentSchema = z.object({
  filename: z.string().min(1).max(240),
  file_type: z.string().min(1).max(20).default("txt"),
  content: z.string().min(1).max(500000),
  page_number: z.number().int().positive().optional(),
  chunk_size: z.number().int().min(500).max(4000).default(1200),
  overlap: z.number().int().min(0).max(1000).default(180)
}).refine((value) => value.overlap < value.chunk_size, {
  message: "overlap precisa ser menor que chunk_size",
  path: ["overlap"]
});

export const searchAttachmentChunksSchema = z.object({
  q: z.string().min(1).max(1000),
  limit: z.number().int().min(1).max(20).default(6)
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
