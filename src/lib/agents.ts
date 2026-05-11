export const AGENT_IDS = [
  "orcamento",
  "admin_financeiro",
  "normas",
  "senior",
  "comunicacao",
  "planejamento"
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export interface AgentDefinition {
  id: AgentId;
  name: string;
  shortName: string;
  mission: string;
  expectedOutput: string;
  defaultModel: string;
}

export const DEFAULT_MODEL = "google/gemini-3.5-flash";

export const AGENTS: Record<AgentId, AgentDefinition> = {
  orcamento: {
    id: "orcamento",
    name: "Orçamento Técnico",
    shortName: "Orçamento",
    mission: "Formar preço técnico em cenários rápido, normal e premium para engenheiros PJ.",
    expectedOutput: "JSON estruturado com premissas, composição de custos, riscos, impostos, BDI e recomendação.",
    defaultModel: DEFAULT_MODEL
  },
  admin_financeiro: {
    id: "admin_financeiro",
    name: "Admin Financeiro PJ",
    shortName: "Financeiro",
    mission: "Apoiar gestão financeira PJ, DAS, ISS, fluxo de caixa, aging e KPIs.",
    expectedOutput: "Relatório executivo com alertas fiscais, próximos vencimentos, indicadores e ações práticas.",
    defaultModel: DEFAULT_MODEL
  },
  normas: {
    id: "normas",
    name: "Consultor de Normas",
    shortName: "Normas",
    mission: "Mapear normas NBR, NR, IEC e ASME potencialmente aplicáveis ao escopo técnico.",
    expectedOutput: "Checklist normativo com aplicabilidade, evidências necessárias, lacunas e cautelas de validação.",
    defaultModel: DEFAULT_MODEL
  },
  senior: {
    id: "senior",
    name: "Consultor Sênior",
    shortName: "Sênior",
    mission: "Fazer análise crítica, advogado do diabo técnico, riscos e alternativas.",
    expectedOutput: "Diagnóstico, principais riscos, duas alternativas viáveis e recomendação final justificada.",
    defaultModel: DEFAULT_MODEL
  },
  comunicacao: {
    id: "comunicacao",
    name: "Comunicação Pro",
    shortName: "Comunicação",
    mission: "Redigir comunicação profissional para clientes, propostas, e-mails e mensagens difíceis.",
    expectedOutput: "Três versões: curta, padrão e formal, com tom técnico cordial e próximos passos claros.",
    defaultModel: DEFAULT_MODEL
  },
  planejamento: {
    id: "planejamento",
    name: "Planejamento & Execução",
    shortName: "Planejamento",
    mission: "Converter metas técnicas em plano GTD, Kanban e dependências PERT/CPM.",
    expectedOutput: "Semana planejada, backlog priorizado, dependências, riscos de cronograma e primeira ação concreta.",
    defaultModel: DEFAULT_MODEL
  }
};

export function isAgentId(value: string): value is AgentId {
  return (AGENT_IDS as readonly string[]).includes(value);
}

export function getAgent(agentId: string): AgentDefinition {
  return AGENTS[isAgentId(agentId) ? agentId : "comunicacao"];
}
