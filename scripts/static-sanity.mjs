import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "app/api/chat/route.ts",
  "app/api/conversations/route.ts",
  "app/api/conversations/[conversationId]/route.ts",
  "app/api/feedback/route.ts",
  "app/api/metrics/route.ts",
  "app/api/profile/route.ts",
  "app/api/admin/prompts/route.ts",
  "app/api/admin/prompts/[promptId]/route.ts",
  "app/api/conversations/[conversationId]/attachments/route.ts",
  "app/api/attachments/[attachmentId]/chunks/route.ts",
  "app/api/attachments/[attachmentId]/route.ts",
  "src/server/ai-chat.functions.ts",
  "src/server/ai-output-guards.ts",
  "src/server/ai-security.ts",
  "supabase/migrations/001_initial_schema.sql",
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length) {
  throw new Error(`Arquivos obrigatórios ausentes: ${missing.join(", ")}`);
}

const migration = readFileSync("supabase/migrations/001_initial_schema.sql", "utf8");
const forbiddenSql = [
  /GRANT\s+ALL\s+ON\s+public\.ai_metrics\s+TO\s+authenticated/i,
  /REFRESH\s+MATERIALIZED\s+VIEW\s+CONCURRENTLY\s+IF\s+EXISTS\s+public\.vw_/i,
];

for (const pattern of forbiddenSql) {
  if (pattern.test(migration)) {
    throw new Error(`Migration contém padrão inseguro/inválido: ${pattern}`);
  }
}

for (const expected of [
  "WITH (security_invoker = true)",
  "WHERE c.id = p_conversation_id AND c.user_id = auth.uid()",
  "LIMIT LEAST(GREATEST(p_limit, 1), 100)",
]) {
  if (!migration.includes(expected)) {
    throw new Error(`Migration não contém hardening esperado: ${expected}`);
  }
}

const chat = readFileSync("src/server/ai-chat.functions.ts", "utf8");
for (const expected of [
  "ensureConversationOwnership",
  "normalizeHandoffs",
  "routingSchema.safeParse",
  "Roteamento inválido normalizado pelo backend",
  "rankChunksForQuery",
]) {
  if (!chat.includes(expected)) {
    throw new Error(`Chat backend não contém hardening esperado: ${expected}`);
  }
}

const adminPromptsRoute = readFileSync("app/api/admin/prompts/route.ts", "utf8");
for (const expected of ["createAgentPromptSchema", "isAdminEmail", "agent_prompts", "version"]) {
  if (!adminPromptsRoute.includes(expected)) {
    throw new Error(`Admin prompts route não contém comportamento esperado: ${expected}`);
  }
}

const adminPromptDetailRoute = readFileSync("app/api/admin/prompts/[promptId]/route.ts", "utf8");
for (const expected of ["updateAgentPromptSchema", "isAdminEmail", "promptId inválido"]) {
  if (!adminPromptDetailRoute.includes(expected)) {
    throw new Error(`Admin prompt detail route não contém comportamento esperado: ${expected}`);
  }
}

const attachmentRoute = readFileSync("app/api/conversations/[conversationId]/attachments/route.ts", "utf8");
for (const expected of ["ingestAttachmentSchema", "chunkText", "attachment_chunks", "ensureConversationOwner"]) {
  if (!attachmentRoute.includes(expected)) {
    throw new Error(`Attachment route não contém comportamento esperado: ${expected}`);
  }
}

const attachmentDetailRoute = readFileSync("app/api/attachments/[attachmentId]/route.ts", "utf8");
for (const expected of ["DELETE", "ensureAttachmentOwner", "Anexo não encontrado"]) {
  if (!attachmentDetailRoute.includes(expected)) {
    throw new Error(`Attachment detail route não contém comportamento esperado: ${expected}`);
  }
}

const attachmentChunksRoute = readFileSync("app/api/attachments/[attachmentId]/chunks/route.ts", "utf8");
for (const expected of ["searchAttachmentChunksSchema", "ensureAttachmentOwner", "score"]) {
  if (!attachmentChunksRoute.includes(expected)) {
    throw new Error(`Attachment chunks route não contém comportamento esperado: ${expected}`);
  }
}

const profileRoute = readFileSync("app/api/profile/route.ts", "utf8");
for (const expected of ["upsertEngineerProfileSchema", "user_engineer_profile", 'onConflict: "user_id"']) {
  if (!profileRoute.includes(expected)) {
    throw new Error(`Profile route não contém comportamento esperado: ${expected}`);
  }
}

const conversationDetailRoute = readFileSync("app/api/conversations/[conversationId]/route.ts", "utf8");
for (const expected of ["ai_messages", "conversationId inválido", 'status: "deleted"']) {
  if (!conversationDetailRoute.includes(expected)) {
    throw new Error(`Conversation detail route não contém comportamento esperado: ${expected}`);
  }
}

console.log("Static sanity checks passed.");
