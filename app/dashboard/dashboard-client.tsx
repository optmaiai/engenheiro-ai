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
  const [attachmentText, setAttachmentText] = useState("Memorial técnico: carga de vento na cobertura exige validação por norma aplicável.");
  const [conversations, setConversations] = useState<ApiState<{ conversations: Conversation[] }>>(emptyState);
  const [chat, setChat] = useState<ApiState<ChatResponse>>(emptyState);
  const [profile, setProfile] = useState<ApiState<unknown>>(emptyState);
  const [attachment, setAttachment] = useState<ApiState<unknown>>(emptyState);
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

  async function ingestAttachment() {
    if (!conversationId) {
      setAttachment({ loading: false, error: "Crie ou selecione uma conversa antes de anexar contexto." });
      return;
    }

    setAttachment({ loading: true });
    try {
      const payload = await parseApiResponse<unknown>(
        await fetch(`/api/conversations/${conversationId}/attachments`, {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ filename: "contexto-demo.txt", file_type: "txt", content: attachmentText })
        })
      );
      setAttachment({ loading: false, data: payload });
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
                  }}
                >
                  <span className="block font-semibold text-white">{conversation.title}</span>
                  <span className="text-xs text-slate-400">{conversation.agent_id} · {conversation.status}</span>
                </button>
              ))}
              {conversations.error && <p className="text-sm text-red-300">{conversations.error}</p>}
            </div>
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

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Anexo textual</h2>
            <textarea
              className="mt-4 h-28 w-full rounded-2xl border border-slate-700 bg-slate-900 p-3 text-sm"
              value={attachmentText}
              onChange={(event) => setAttachmentText(event.target.value)}
            />
            <button className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950" type="button" onClick={ingestAttachment} disabled={!token || attachment.loading}>
              Ingerir anexo
            </button>
            <ResultPanel title="Anexo" state={attachment} compact />
          </section>

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
