"use client";

import { FormEvent, useMemo, useState } from "react";
import { AGENTS, type AgentId } from "@/lib/agents";

type Conversation = {
  id: string;
  title: string;
  agent_id: AgentId;
  status: string;
  updated_at?: string;
};

type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  agent_id?: AgentId | null;
  content: string;
  routing_json?: unknown;
  structured_output?: unknown;
  citations?: unknown;
  tokens_in?: number | null;
  tokens_out?: number | null;
  latency_ms?: number | null;
  cost_usd?: number | null;
  created_at?: string;
};

type ConversationDetail = Conversation & {
  created_at?: string;
  metadata?: unknown;
  messages: ConversationMessage[];
};

type ChatResponse = {
  conversation_id: string;
  message_id: string;
  agent_id: AgentId;
  content: string;
  routing_json?: unknown;
  guardrails_triggered?: unknown[];
};

type AgentPrompt = {
  id: string;
  agent_id: AgentId;
  version: number;
  title: string;
  content: string;
  notes?: string | null;
  is_active: boolean;
  model_override?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
};

type AttachmentRecord = {
  id: string;
  filename: string;
  file_type: string;
  file_size_bytes?: number | null;
  extracted_pages?: number | null;
  chunks_count?: number | null;
  created_at?: string;
};

type AttachmentChunk = {
  id: string;
  chunk_index: number;
  content: string;
  page_number?: number | null;
  char_start?: number | null;
  char_end?: number | null;
  score?: number;
  created_at?: string;
};

type AttachmentIngestPayload = {
  attachment: AttachmentRecord;
  chunks_created: number;
};

type AttachmentSearchPayload = {
  attachment: AttachmentRecord;
  chunks: AttachmentChunk[];
  query: string;
};

type ApiState<T> = {
  data?: T;
  error?: string;
  loading: boolean;
};

type DashboardMetricsPayload = {
  metrics: null | {
    requests_total: number;
    requests_failed: number;
    avg_latency_ms: number;
    total_tokens: number;
    total_cost_usd: number;
    routing_acceptance_rate: number;
    top_guardrails_triggered: Array<{ name: string; count: number }>;
  };
};

const emptyState = { loading: false };
const defaultPromptContent =
  "Você é um agente especialista da Engenheiro.AI. Responda com precisão técnica, explicite premissas, cite cautelas quando necessário e entregue próximos passos acionáveis para engenheiros PJ.";

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Erro HTTP ${response.status}`);
  return payload;
}

export default function DashboardClient() {
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem("engenheiro-ai-token") || ""
  );
  const [agentId, setAgentId] = useState<AgentId>("comunicacao");
  const [message, setMessage] = useState("Monte uma resposta profissional para cobrar retorno de proposta técnica.");
  const [conversationId, setConversationId] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem("engenheiro-ai-conversation") || ""
  );
  const [profileJson, setProfileJson] = useState(
    JSON.stringify({ crea_uf: "SP", especialidades: ["estruturas"], hora_tecnica_brl: 250 }, null, 2)
  );
  const [attachmentFilename, setAttachmentFilename] = useState("contexto-demo.txt");
  const [attachmentText, setAttachmentText] = useState("Memorial técnico: carga de vento na cobertura exige validação por norma aplicável.");
  const [attachmentChunkSize, setAttachmentChunkSize] = useState(1200);
  const [attachmentOverlap, setAttachmentOverlap] = useState(180);
  const [attachmentQuery, setAttachmentQuery] = useState("carga vento cobertura");
  const [selectedAttachmentId, setSelectedAttachmentId] = useState("");
  const [conversations, setConversations] = useState<ApiState<{ conversations: Conversation[] }>>(emptyState);
  const [conversationDetail, setConversationDetail] = useState<ApiState<{ conversation: ConversationDetail }>>(emptyState);
  const [conversationMutation, setConversationMutation] = useState<ApiState<unknown>>(emptyState);
  const [chat, setChat] = useState<ApiState<ChatResponse>>(emptyState);
  const [profile, setProfile] = useState<ApiState<unknown>>(emptyState);
  const [attachment, setAttachment] = useState<ApiState<AttachmentIngestPayload>>(emptyState);
  const [attachments, setAttachments] = useState<ApiState<{ attachments: AttachmentRecord[] }>>(emptyState);
  const [attachmentSearch, setAttachmentSearch] = useState<ApiState<AttachmentSearchPayload>>(emptyState);
  const [attachmentMutation, setAttachmentMutation] = useState<ApiState<unknown>>(emptyState);
  const [metricsDays, setMetricsDays] = useState(7);
  const [metrics, setMetrics] = useState<ApiState<DashboardMetricsPayload>>(emptyState);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [feedback, setFeedback] = useState<ApiState<unknown>>(emptyState);
  const [promptAgentId, setPromptAgentId] = useState<AgentId>("comunicacao");
  const [promptTitle, setPromptTitle] = useState("Prompt operacional vNext");
  const [promptContent, setPromptContent] = useState(defaultPromptContent);
  const [promptNotes, setPromptNotes] = useState("Ajuste criado pelo console operacional.");
  const [promptModelOverride, setPromptModelOverride] = useState("");
  const [promptActive, setPromptActive] = useState(false);
  const [prompts, setPrompts] = useState<ApiState<{ prompts: AgentPrompt[] }>>(emptyState);
  const [promptMutation, setPromptMutation] = useState<ApiState<unknown>>(emptyState);

  const selectedAgent = useMemo(() => AGENTS[agentId], [agentId]);


  function persistToken(nextToken: string) {
    setToken(nextToken);
    window.localStorage.setItem("engenheiro-ai-token", nextToken);
  }

  function persistConversation(nextConversationId: string) {
    setConversationId(nextConversationId);
    window.localStorage.setItem("engenheiro-ai-conversation", nextConversationId);
  }

  async function loadConversations() {
    setConversations({ loading: true });
    try {
      const payload = await parseApiResponse<{ conversations: Conversation[] }>(
        await fetch("/api/conversations", { headers: authHeaders(token) })
      );
      setConversations({ loading: false, data: payload });
      if (!conversationId && payload.conversations[0]) persistConversation(payload.conversations[0].id);
    } catch (error) {
      setConversations({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  async function loadConversationDetails(nextConversationId = conversationId) {
    if (!nextConversationId) {
      setConversationDetail({ loading: false, error: "Selecione uma conversa para carregar o histórico." });
      return;
    }

    setConversationDetail({ loading: true });
    try {
      const payload = await parseApiResponse<{ conversation: ConversationDetail }>(
        await fetch(`/api/conversations/${nextConversationId}?limit=30`, { headers: authHeaders(token) })
      );
      setConversationDetail({ loading: false, data: payload });
    } catch (error) {
      setConversationDetail({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  async function updateConversationStatus(status: "active" | "archived" | "deleted") {
    if (!conversationId) {
      setConversationMutation({ loading: false, error: "Selecione uma conversa antes de alterar o status." });
      return;
    }

    setConversationMutation({ loading: true });
    try {
      const payload = await parseApiResponse<unknown>(
        await fetch(`/api/conversations/${conversationId}`, {
          method: status === "deleted" ? "DELETE" : "PATCH",
          headers: authHeaders(token),
          body: status === "deleted" ? undefined : JSON.stringify({ status })
        })
      );
      setConversationMutation({ loading: false, data: payload });
      if (status === "deleted") {
        setConversationDetail(emptyState);
        persistConversation("");
      } else {
        void loadConversationDetails(conversationId);
      }
      void loadConversations();
    } catch (error) {
      setConversationMutation({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  async function submitChat(event: FormEvent) {
    event.preventDefault();
    setChat({ loading: true });
    try {
      const payload = await parseApiResponse<ChatResponse>(
        await fetch("/api/chat", {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ conversation_id: conversationId || undefined, agent_id: agentId, message })
        })
      );
      persistConversation(payload.conversation_id);
      setChat({ loading: false, data: payload });
      void loadConversations();
      void loadConversationDetails(payload.conversation_id);
    } catch (error) {
      setChat({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  async function updateProfile() {
    setProfile({ loading: true });
    try {
      const payload = await parseApiResponse<unknown>(
        await fetch("/api/profile", {
          method: "PUT",
          headers: authHeaders(token),
          body: profileJson
        })
      );
      setProfile({ loading: false, data: payload });
    } catch (error) {
      setProfile({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  async function loadAttachments(preferredAttachmentId = selectedAttachmentId) {
    if (!conversationId) {
      setAttachments({ loading: false, error: "Selecione uma conversa antes de listar anexos." });
      return;
    }

    setAttachments({ loading: true });
    try {
      const payload = await parseApiResponse<{ attachments: AttachmentRecord[] }>(
        await fetch(`/api/conversations/${conversationId}/attachments`, { headers: authHeaders(token) })
      );
      setAttachments({ loading: false, data: payload });
      const preferredAttachment = payload.attachments.find((item) => item.id === preferredAttachmentId);
      if (preferredAttachment) setSelectedAttachmentId(preferredAttachment.id);
      else if (payload.attachments[0]) setSelectedAttachmentId(payload.attachments[0].id);
    } catch (error) {
      setAttachments({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  async function deleteSelectedAttachment() {
    if (!selectedAttachmentId) {
      setAttachmentMutation({ loading: false, error: "Selecione um anexo antes de excluir." });
      return;
    }

    setAttachmentMutation({ loading: true });
    try {
      const payload = await parseApiResponse<unknown>(
        await fetch(`/api/attachments/${selectedAttachmentId}`, {
          method: "DELETE",
          headers: authHeaders(token)
        })
      );
      setAttachmentMutation({ loading: false, data: payload });
      setSelectedAttachmentId("");
      setAttachmentSearch(emptyState);
      void loadAttachments("");
    } catch (error) {
      setAttachmentMutation({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  async function searchAttachmentChunks() {
    if (!selectedAttachmentId) {
      setAttachmentSearch({ loading: false, error: "Selecione ou ingira um anexo antes de buscar chunks." });
      return;
    }

    setAttachmentSearch({ loading: true });
    try {
      const payload = await parseApiResponse<AttachmentSearchPayload>(
        await fetch(`/api/attachments/${selectedAttachmentId}/chunks?q=${encodeURIComponent(attachmentQuery)}&limit=6`, { headers: authHeaders(token) })
      );
      setAttachmentSearch({ loading: false, data: payload });
    } catch (error) {
      setAttachmentSearch({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  async function ingestAttachment() {
    if (!conversationId) {
      setAttachment({ loading: false, error: "Crie ou selecione uma conversa antes de anexar contexto." });
      return;
    }

    setAttachment({ loading: true });
    try {
      const payload = await parseApiResponse<AttachmentIngestPayload>(
        await fetch(`/api/conversations/${conversationId}/attachments`, {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({
            filename: attachmentFilename,
            file_type: "txt",
            content: attachmentText,
            chunk_size: attachmentChunkSize,
            overlap: attachmentOverlap
          })
        })
      );
      setAttachment({ loading: false, data: payload });
      setSelectedAttachmentId(payload.attachment.id);
      void loadAttachments(payload.attachment.id);
    } catch (error) {
      setAttachment({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  async function loadMetrics() {
    setMetrics({ loading: true });
    try {
      const payload = await parseApiResponse<DashboardMetricsPayload>(
        await fetch(`/api/metrics?days=${metricsDays}`, { headers: authHeaders(token) })
      );
      setMetrics({ loading: false, data: payload });
    } catch (error) {
      setMetrics({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  async function loadPrompts() {
    setPrompts({ loading: true });
    try {
      const payload = await parseApiResponse<{ prompts: AgentPrompt[] }>(
        await fetch(`/api/admin/prompts?agent_id=${encodeURIComponent(promptAgentId)}`, { headers: authHeaders(token) })
      );
      setPrompts({ loading: false, data: payload });
    } catch (error) {
      setPrompts({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  async function createPromptVersion() {
    setPromptMutation({ loading: true });
    try {
      const payload = await parseApiResponse<unknown>(
        await fetch("/api/admin/prompts", {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({
            agent_id: promptAgentId,
            title: promptTitle,
            content: promptContent,
            notes: promptNotes || undefined,
            is_active: promptActive,
            model_override: promptModelOverride || undefined
          })
        })
      );
      setPromptMutation({ loading: false, data: payload });
      void loadPrompts();
    } catch (error) {
      setPromptMutation({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  async function activatePrompt(promptId: string) {
    setPromptMutation({ loading: true });
    try {
      const payload = await parseApiResponse<unknown>(
        await fetch(`/api/admin/prompts/${promptId}`, {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ is_active: true })
        })
      );
      setPromptMutation({ loading: false, data: payload });
      void loadPrompts();
    } catch (error) {
      setPromptMutation({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  async function submitFeedback(rating: -1 | 0 | 1) {
    if (!chat.data?.message_id) {
      setFeedback({ loading: false, error: "Envie uma mensagem e aguarde a resposta antes de avaliar." });
      return;
    }

    setFeedback({ loading: true });
    try {
      const payload = await parseApiResponse<unknown>(
        await fetch("/api/feedback", {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({
            message_id: chat.data.message_id,
            conversation_id: chat.data.conversation_id,
            agent_id: chat.data.agent_id,
            rating,
            notes: feedbackNotes || undefined
          })
        })
      );
      setFeedback({ loading: false, data: payload });
    } catch (error) {
      setFeedback({ loading: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-10 text-slate-100">
      <section className="mb-8 rounded-3xl border border-cyan-400/20 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/30">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Console operacional</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <h1 className="text-3xl font-bold text-white md:text-5xl">Teste agentes, memória e RAG em um só lugar.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
              Cole um JWT Supabase, selecione um agente, envie mensagens, atualize o perfil técnico e injete anexos textuais na conversa para validar o fluxo ponta a ponta.
            </p>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">JWT Supabase</span>
            <textarea
              className="h-28 w-full rounded-2xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-100 outline-none ring-cyan-400/40 focus:ring-2"
              placeholder="Bearer token do usuário autenticado"
              value={token}
              onChange={(event) => persistToken(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={submitChat} className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-medium text-slate-300">Agente</span>
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value as AgentId)}
              >
                {Object.values(AGENTS).map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-slate-300">Conversa ativa</span>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"
                placeholder="UUID opcional"
                value={conversationId}
                onChange={(event) => persistConversation(event.target.value)}
              />
            </label>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-900/80 p-4 text-sm text-slate-300">
            <strong className="text-cyan-300">{selectedAgent.shortName}:</strong> {selectedAgent.mission}
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Mensagem</span>
            <textarea
              className="h-36 w-full rounded-2xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100 outline-none ring-cyan-400/40 focus:ring-2"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <button className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950" type="submit" disabled={!token || chat.loading}>
              {chat.loading ? "Enviando..." : "Enviar ao agente"}
            </button>
            <button className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold" type="button" onClick={loadConversations} disabled={!token || conversations.loading}>
              Atualizar conversas
            </button>
          </div>

          <ResultPanel title="Resposta do agente" state={chat} />
          <FeedbackPanel
            disabled={!token || !chat.data?.message_id || feedback.loading}
            notes={feedbackNotes}
            onNotesChange={setFeedbackNotes}
            onSubmit={submitFeedback}
            state={feedback}
          />
        </form>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Conversas</h2>
            <div className="mt-4 space-y-2">
              {(conversations.data?.conversations || []).map((conversation) => (
                <button
                  key={conversation.id}
                  className="block w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-left text-sm hover:border-cyan-400"
                  type="button"
                  onClick={() => {
                    persistConversation(conversation.id);
                    setAgentId(conversation.agent_id);
                    void loadConversationDetails(conversation.id);
                  }}
                >
                  <span className="block font-semibold text-white">{conversation.title}</span>
                  <span className="text-xs text-slate-400">{conversation.agent_id} · {conversation.status}</span>
                </button>
              ))}
              {conversations.error && <p className="text-sm text-red-300">{conversations.error}</p>}
            </div>
            <ConversationHistoryPanel
              activeConversationId={conversationId}
              mutationState={conversationMutation}
              onArchive={() => updateConversationStatus("archived")}
              onDelete={() => updateConversationStatus("deleted")}
              onLoad={() => loadConversationDetails()}
              onReactivate={() => updateConversationStatus("active")}
              state={conversationDetail}
              tokenPresent={Boolean(token)}
            />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Perfil técnico</h2>
            <textarea
              className="mt-4 h-36 w-full rounded-2xl border border-slate-700 bg-slate-900 p-3 font-mono text-xs"
              value={profileJson}
              onChange={(event) => setProfileJson(event.target.value)}
            />
            <button className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950" type="button" onClick={updateProfile} disabled={!token || profile.loading}>
              Salvar perfil
            </button>
            <ResultPanel title="Perfil" state={profile} compact />
          </section>

          <AttachmentRagPanel
            attachmentChunkSize={attachmentChunkSize}
            attachmentFilename={attachmentFilename}
            attachmentOverlap={attachmentOverlap}
            attachmentQuery={attachmentQuery}
            attachmentState={attachment}
            attachmentsState={attachments}
            attachmentText={attachmentText}
            disabled={!token}
            mutationState={attachmentMutation}
            onAttachmentChunkSizeChange={setAttachmentChunkSize}
            onAttachmentFilenameChange={setAttachmentFilename}
            onAttachmentOverlapChange={setAttachmentOverlap}
            onAttachmentQueryChange={setAttachmentQuery}
            onAttachmentTextChange={setAttachmentText}
            onDelete={deleteSelectedAttachment}
            onIngest={ingestAttachment}
            onList={loadAttachments}
            onSearch={searchAttachmentChunks}
            onSelectAttachment={setSelectedAttachmentId}
            searchState={attachmentSearch}
            selectedAttachmentId={selectedAttachmentId}
          />

          <PromptAdminPanel
            active={promptActive}
            agentId={promptAgentId}
            content={promptContent}
            disabled={!token}
            modelOverride={promptModelOverride}
            mutationState={promptMutation}
            notes={promptNotes}
            onActiveChange={setPromptActive}
            onAgentChange={setPromptAgentId}
            onActivatePrompt={activatePrompt}
            onContentChange={setPromptContent}
            onCreatePrompt={createPromptVersion}
            onLoadPrompts={loadPrompts}
            onModelOverrideChange={setPromptModelOverride}
            onNotesChange={setPromptNotes}
            onTitleChange={setPromptTitle}
            promptsState={prompts}
            title={promptTitle}
          />

          <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
            <h2 className="text-xl font-semibold text-white">Métricas admin</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Use um JWT permitido em <code>ADMIN_EMAILS</code> para consultar agregados operacionais.</p>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Janela em dias</span>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"
                min={1}
                max={90}
                type="number"
                value={metricsDays}
                onChange={(event) => setMetricsDays(Number(event.target.value || 7))}
              />
            </label>
            <button className="mt-3 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" type="button" onClick={loadMetrics} disabled={!token || metrics.loading}>
              Carregar métricas
            </button>
            <MetricsSummary metrics={metrics.data?.metrics} />
            <ResultPanel title="Payload de métricas" state={metrics} compact />
          </section>
        </aside>
      </section>
    </main>
  );
}



function ConversationHistoryPanel({
  activeConversationId,
  mutationState,
  onArchive,
  onDelete,
  onLoad,
  onReactivate,
  state,
  tokenPresent
}: {
  activeConversationId: string;
  mutationState: ApiState<unknown>;
  onArchive: () => void;
  onDelete: () => void;
  onLoad: () => void;
  onReactivate: () => void;
  state: ApiState<{ conversation: ConversationDetail }>;
  tokenPresent: boolean;
}) {
  const conversation = state.data?.conversation;

  return (
    <section className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Histórico ativo</h3>
          <p className="mt-1 text-xs text-slate-400">Carregue mensagens, metadados e status da conversa selecionada.</p>
        </div>
        <button className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950" disabled={!tokenPresent || !activeConversationId || state.loading} type="button" onClick={onLoad}>
          Carregar
        </button>
      </div>

      {conversation && (
        <>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300">
            <p className="font-semibold text-white">{conversation.title}</p>
            <p className="mt-1">{conversation.agent_id} · {conversation.status} · {conversation.messages.length} mensagens</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold" disabled={!tokenPresent || mutationState.loading || conversation.status === "archived"} type="button" onClick={onArchive}>
              Arquivar
            </button>
            <button className="rounded-lg border border-emerald-400/50 px-3 py-2 text-xs font-semibold text-emerald-200" disabled={!tokenPresent || mutationState.loading || conversation.status === "active"} type="button" onClick={onReactivate}>
              Reativar
            </button>
            <button className="rounded-lg border border-red-400/50 px-3 py-2 text-xs font-semibold text-red-200" disabled={!tokenPresent || mutationState.loading} type="button" onClick={onDelete}>
              Excluir
            </button>
          </div>
          <div className="mt-4 max-h-96 space-y-3 overflow-auto pr-1">
            {conversation.messages.map((message) => (
              <article key={message.id} className={`rounded-2xl border p-3 ${message.role === "assistant" ? "border-cyan-400/20 bg-cyan-400/10" : "border-slate-700 bg-slate-900"}`}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                  <span>{message.role}{message.agent_id ? ` · ${message.agent_id}` : ""}</span>
                  {message.latency_ms ? <span>{Math.round(message.latency_ms)} ms</span> : null}
                </div>
                <p className="whitespace-pre-wrap text-xs leading-5 text-slate-100">{message.content}</p>
                {(message.tokens_in || message.tokens_out || message.cost_usd) && (
                  <p className="mt-2 text-[10px] text-slate-500">
                    tokens {message.tokens_in || 0}/{message.tokens_out || 0} · ${Number(message.cost_usd || 0).toFixed(4)}
                  </p>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      <ResultPanel title="Status da conversa" state={mutationState} compact />
      <ResultPanel title="Payload da conversa" state={state} compact />
    </section>
  );
}


function AttachmentRagPanel({
  attachmentChunkSize,
  attachmentFilename,
  attachmentOverlap,
  attachmentQuery,
  attachmentState,
  attachmentsState,
  attachmentText,
  disabled,
  mutationState,
  onAttachmentChunkSizeChange,
  onAttachmentFilenameChange,
  onAttachmentOverlapChange,
  onAttachmentQueryChange,
  onAttachmentTextChange,
  onDelete,
  onIngest,
  onList,
  onSearch,
  onSelectAttachment,
  searchState,
  selectedAttachmentId
}: {
  attachmentChunkSize: number;
  attachmentFilename: string;
  attachmentOverlap: number;
  attachmentQuery: string;
  attachmentState: ApiState<AttachmentIngestPayload>;
  attachmentsState: ApiState<{ attachments: AttachmentRecord[] }>;
  attachmentText: string;
  disabled: boolean;
  mutationState: ApiState<unknown>;
  onAttachmentChunkSizeChange: (chunkSize: number) => void;
  onAttachmentFilenameChange: (filename: string) => void;
  onAttachmentOverlapChange: (overlap: number) => void;
  onAttachmentQueryChange: (query: string) => void;
  onAttachmentTextChange: (text: string) => void;
  onDelete: () => void;
  onIngest: () => void;
  onList: () => void;
  onSearch: () => void;
  onSelectAttachment: (attachmentId: string) => void;
  searchState: ApiState<AttachmentSearchPayload>;
  selectedAttachmentId: string;
}) {
  const attachmentOptions = attachmentsState.data?.attachments || [];
  const chunks = searchState.data?.chunks || [];
  const invalidChunking = attachmentOverlap >= attachmentChunkSize;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold text-white">Anexos RAG</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">Ingira contexto textual, liste anexos da conversa e valide os chunks recuperados antes de chamar o agente.</p>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-medium text-slate-300">Nome do arquivo</span>
        <input
          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"
          value={attachmentFilename}
          onChange={(event) => onAttachmentFilenameChange(event.target.value)}
        />
      </label>
      <textarea
        className="mt-4 h-28 w-full rounded-2xl border border-slate-700 bg-slate-900 p-3 text-sm"
        value={attachmentText}
        onChange={(event) => onAttachmentTextChange(event.target.value)}
      />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Tamanho do chunk</span>
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"
            max={4000}
            min={500}
            type="number"
            value={attachmentChunkSize}
            onChange={(event) => onAttachmentChunkSizeChange(Number(event.target.value || 1200))}
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Overlap</span>
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"
            max={1000}
            min={0}
            type="number"
            value={attachmentOverlap}
            onChange={(event) => onAttachmentOverlapChange(Number(event.target.value || 0))}
          />
        </label>
      </div>
      {invalidChunking && <p className="mt-2 text-xs text-red-300">Overlap precisa ser menor que o tamanho do chunk.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950" type="button" onClick={onIngest} disabled={disabled || attachmentState.loading || invalidChunking}>
          Ingerir anexo
        </button>
        <button className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold" type="button" onClick={onList} disabled={disabled || attachmentsState.loading}>
          Listar anexos
        </button>
        <button className="rounded-xl border border-red-400/50 px-4 py-2 text-sm font-semibold text-red-200" type="button" onClick={onDelete} disabled={disabled || !selectedAttachmentId || mutationState.loading}>
          Excluir selecionado
        </button>
      </div>

      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-medium text-slate-300">Anexo para busca</span>
        <select
          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"
          value={selectedAttachmentId}
          onChange={(event) => onSelectAttachment(event.target.value)}
        >
          <option value="">Selecione um anexo</option>
          {attachmentOptions.map((attachment) => (
            <option key={attachment.id} value={attachment.id}>{attachment.filename} · {attachment.chunks_count || 0} chunks</option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="mb-2 block text-sm font-medium text-slate-300">Consulta RAG</span>
        <input
          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"
          value={attachmentQuery}
          onChange={(event) => onAttachmentQueryChange(event.target.value)}
        />
      </label>
      <button className="mt-3 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" type="button" onClick={onSearch} disabled={disabled || !selectedAttachmentId || searchState.loading}>
        Buscar chunks
      </button>

      {chunks.length > 0 && (
        <div className="mt-4 space-y-2">
          {chunks.map((chunk) => (
            <article key={chunk.id} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">chunk {chunk.chunk_index}{chunk.page_number ? ` · pág. ${chunk.page_number}` : ""}{typeof chunk.score === "number" ? ` · score ${chunk.score}` : ""}</p>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-200">{chunk.content}</p>
            </article>
          ))}
        </div>
      )}

      <ResultPanel title="Anexo" state={attachmentState} compact />
      <ResultPanel title="Lista de anexos" state={attachmentsState} compact />
      <ResultPanel title="Busca em chunks" state={searchState} compact />
      <ResultPanel title="Status do anexo" state={mutationState} compact />
    </section>
  );
}

function PromptAdminPanel({
  active,
  agentId,
  content,
  disabled,
  modelOverride,
  mutationState,
  notes,
  onActiveChange,
  onActivatePrompt,
  onAgentChange,
  onContentChange,
  onCreatePrompt,
  onLoadPrompts,
  onModelOverrideChange,
  onNotesChange,
  onTitleChange,
  promptsState,
  title
}: {
  active: boolean;
  agentId: AgentId;
  content: string;
  disabled: boolean;
  modelOverride: string;
  mutationState: ApiState<unknown>;
  notes: string;
  onActiveChange: (active: boolean) => void;
  onActivatePrompt: (promptId: string) => void;
  onAgentChange: (agentId: AgentId) => void;
  onContentChange: (content: string) => void;
  onCreatePrompt: () => void;
  onLoadPrompts: () => void;
  onModelOverrideChange: (model: string) => void;
  onNotesChange: (notes: string) => void;
  onTitleChange: (title: string) => void;
  promptsState: ApiState<{ prompts: AgentPrompt[] }>;
  title: string;
}) {
  const prompts = promptsState.data?.prompts || [];

  return (
    <section className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-6">
      <h2 className="text-xl font-semibold text-white">Prompts admin</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">Crie versões, audite histórico e ative o prompt operacional por agente usando um JWT admin.</p>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-medium text-slate-300">Agente do prompt</span>
        <select
          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"
          value={agentId}
          onChange={(event) => onAgentChange(event.target.value as AgentId)}
        >
          {Object.values(AGENTS).map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.name}</option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="mb-2 block text-sm font-medium text-slate-300">Título</span>
        <input
          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-2 block text-sm font-medium text-slate-300">Prompt</span>
        <textarea
          className="h-40 w-full rounded-2xl border border-slate-700 bg-slate-900 p-3 font-mono text-xs"
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
        />
      </label>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Modelo override opcional</span>
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"
            placeholder="ex.: openai/gpt-4.1"
            value={modelOverride}
            onChange={(event) => onModelOverrideChange(event.target.value)}
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Notas</span>
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
          />
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
        <input checked={active} type="checkbox" onChange={(event) => onActiveChange(event.target.checked)} />
        Ativar esta versão após criar
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950" disabled={disabled || mutationState.loading} type="button" onClick={onCreatePrompt}>
          Criar versão
        </button>
        <button className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold" disabled={disabled || promptsState.loading} type="button" onClick={onLoadPrompts}>
          Listar versões
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {prompts.map((prompt) => (
          <article key={prompt.id} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">v{prompt.version} · {prompt.title}</p>
                <p className="text-xs text-slate-400">{prompt.agent_id}{prompt.model_override ? ` · ${prompt.model_override}` : ""}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${prompt.is_active ? "bg-emerald-300 text-slate-950" : "bg-slate-800 text-slate-300"}`}>
                {prompt.is_active ? "Ativo" : "Inativo"}
              </span>
            </div>
            {prompt.notes && <p className="mt-2 text-xs text-slate-400">{prompt.notes}</p>}
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-300">{prompt.content}</p>
            {!prompt.is_active && (
              <button className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-950" disabled={disabled || mutationState.loading} type="button" onClick={() => onActivatePrompt(prompt.id)}>
                Ativar versão
              </button>
            )}
          </article>
        ))}
      </div>
      <ResultPanel title="Lista de prompts" state={promptsState} compact />
      <ResultPanel title="Status do prompt" state={mutationState} compact />
    </section>
  );
}

function FeedbackPanel({
  disabled,
  notes,
  onNotesChange,
  onSubmit,
  state
}: {
  disabled: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
  onSubmit: (rating: -1 | 0 | 1) => void;
  state: ApiState<unknown>;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Feedback da resposta</h3>
      <p className="mt-2 text-xs leading-5 text-slate-400">Registre se a última resposta ajudou. Esse loop alimenta métricas por agente.</p>
      <textarea
        className="mt-3 h-20 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-100"
        placeholder="Observações ou correções opcionais"
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950" disabled={disabled} type="button" onClick={() => onSubmit(1)}>
          👍 Útil
        </button>
        <button className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-950" disabled={disabled} type="button" onClick={() => onSubmit(0)}>
          Neutro
        </button>
        <button className="rounded-lg bg-red-300 px-3 py-2 text-xs font-semibold text-slate-950" disabled={disabled} type="button" onClick={() => onSubmit(-1)}>
          👎 Corrigir
        </button>
      </div>
      <ResultPanel title="Status do feedback" state={state} compact />
    </section>
  );
}

function MetricsSummary({ metrics }: { metrics?: DashboardMetricsPayload["metrics"] }) {
  if (!metrics) return null;

  const cards = [
    ["Requests", metrics.requests_total],
    ["Falhas", metrics.requests_failed],
    ["Latência média", `${Math.round(metrics.avg_latency_ms || 0)} ms`],
    ["Tokens", metrics.total_tokens],
    ["Custo", `$${Number(metrics.total_cost_usd || 0).toFixed(4)}`],
    ["Aceite routing", `${Math.round(metrics.routing_acceptance_rate || 0)}%`]
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-cyan-400/20 bg-slate-950/70 p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-lg font-semibold text-white">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ResultPanel<T>({ title, state, compact = false }: { title: string; state: ApiState<T>; compact?: boolean }) {
  if (!state.error && !state.data && !state.loading) return null;

  return (
    <section className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">{title}</h3>
      {state.loading && <p className="mt-2 text-sm text-slate-300">Carregando...</p>}
      {state.error && <p className="mt-2 whitespace-pre-wrap text-sm text-red-300">{state.error}</p>}
      {state.data && (
        <pre className={`${compact ? "max-h-40" : "max-h-96"} mt-3 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-200`}>
          {typeof state.data === "object" && "content" in state.data
            ? String((state.data as unknown as ChatResponse).content)
            : JSON.stringify(state.data, null, 2)}
        </pre>
      )}
    </section>
  );
}
