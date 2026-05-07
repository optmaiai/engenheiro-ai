# Engenheiro.AI — Sistema de IA para Engenheiros PJ

![Status](https://img.shields.io/badge/status-sprint%201%20complete-brightgreen) ![Language](https://img.shields.io/badge/language-TypeScript-blue) ![Database](https://img.shields.io/badge/database-Supabase-darkblue)

Sistema inteligente de orquestração de agentes IA especializado para engenheiros brasileiros operando como Pessoa Jurídica (PJ) no regime Simples Nacional.

## 🎯 Visão Geral

**Engenheiro.AI** é uma plataforma que integra 6 agentes especializados, cada um com expertise em um domínio crítico:

| Agente | Especialidade | Saída |
|--------|---------------|-------|
| **Orçamento Técnico** | Formação de preço em 3 cenários (Rápido/Normal/Premium) | JSON estruturado + análise de riscos |
| **Admin Financeiro PJ** | Gestão financeira, DAS, ISS, KPIs, aging | Relatório executivo mensal |
| **Consultor de Normas** | NBR, NR, IEC, ASME aplicáveis ao projeto | Checklist normativo + citações |
| **Consultor Sênior** | Análise crítica, riscos, alternativas | Diagnóstico + 2 alternativas + recomendação |
| **Comunicação Pro** | Redação profissional de e-mails e propostas | 3 versões (Curta/Padrão/Formal) |
| **Planejamento & Execução** | GTD + Kanban + PERT/CPM | Semana planejada + backlog + dependências |

### Fluxo de Trabalho

```
Usuário → Conversa inicial com Agente 1
           ↓ (se necessário)
           Routing automático → Agente 2
           ↓ (se necessário)
           Routing → Agente 3
           ↓ (sempre)
           Persistência com guardrails + métricas
```

---

## 🏗️ Stack Técnico

- **Frontend**: Next.js 14 (React) com TailwindCSS
- **Backend**: Supabase (PostgreSQL + pgvector + Edge Functions)
- **IA**: Lovable AI Gateway (Google Gemini 3.5 Flash default, extensível)
- **Rate Limiting**: Upstash Redis
- **Observabilidade**: Métricas nativas em PostgreSQL
- **RAG**: pgvector + PDF/DOCX extraction
- **Autenticação**: Supabase Auth (JWT)

---

## 📊 Arquitetura

### Camadas de Prompt (6 SYS layers)

Cada resposta é construída determinísticamente a partir de 6 camadas:

```
SYS-1: Identidade & Missão (hardcoded)
       ↓
SYS-2: Política de Segurança (anti-injection, anti-exfiltração)
       ↓
SYS-3: Protocolo de Orquestração (routing JSON obrigatório)
       ↓
SYS-4: Persona do Agente (versionada em BD)
       ↓
SYS-5: Contexto do Usuário (perfil técnico: CREA, BDI, hora)
       ↓
SYS-6: Contexto da Sessão (anexos extraídos + histórico)
```

**Benefício**: Admin edita SYS-4 sem risco de quebrar segurança. Redeploy não necessário.

### Validação & Guardrails (7 Checks)

Post-LLM pipeline:

1. ✅ **PII Masking** — CPF/CNPJ automaticamente mascarados
2. ✅ **Secret Detection** — API keys, JWT, tokens bloqueados
3. ✅ **Credit Card Detection** — Luhn algorithm
4. ✅ **Response Length** — Min 30 chars para agentes técnicos
5. ✅ **Disclaimer Obrigatório** — Appended em Orçamento/Admin/Normas/Sênior
6. ✅ **JSON Validation** — Zod schemas validados, retry automático
7. ✅ **Routing Format** — ROUTING: {...} validado

### Rate Limiting

- **Per-user**: 10 requests / 60s
- **Per-conversation**: 3 requests / 30s

Implementado com Upstash Redis (serverless).

---

## 📁 Estrutura de Pastas

```
engenheiro-ai/
├── README.md
├── package.json
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql        # 11 tabelas + RLS + pgvector + views
│   └── functions/
│       └── chat-stream/
│           └── index.ts                  # Edge function SSE handler
│
├── src/
│   ├── lib/
│   │   └── schemas.ts                    # Zod schemas para validação
│   │
│   └── server/
│       ├── ai-security.ts                # 6 camadas de prompt + injection detection
│       ├── ai-chat.functions.ts          # Data layer + rate limiting
│       ├── ai-output-guards.ts           # 7-layer guardrails pipeline
│       ├── ai-metrics.ts                 # Observabilidade + dashboard queries
│       └── ai-rag.ts                     # PDF/DOCX extraction + chunking + pgvector
│
└── app/
    ├── api/
    │   ├── chat/route.ts                 # Handler para POST /api/chat
    │   └── feedback/route.ts             # Handler para POST /api/feedback
    │
    └── [client pages...]
```

---

## 🚀 Quick Start

### 1. Clonar & Instalar

```bash
git clone https://github.com/optmaiai/engenheiro-ai.git
cd engenheiro-ai

npm install
# ou yarn install
```

### 2. Variáveis de Ambiente

Criar `.env.local`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Lovable AI
LOVABLE_AI_KEY=your-lovable-key

# Opcional: OpenAI para embeddings
OPENAI_API_KEY=your-openai-key
```

### 3. Executar Migrations

```bash
npx supabase migration up
# Ou manual: login Supabase console → SQL Editor → copiar 001_initial_schema.sql
```

### 4. Dev Server

```bash
npm run dev
# http://localhost:3000
```

### 5. Deploy

```bash
# Edge Functions
supabase functions deploy chat-stream

# Frontend (Vercel recomendado)
vercel deploy
```

---

## 📚 Uso da API

### Criar Conversa

```bash
curl -X POST http://localhost:3000/api/conversations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "orcamento",
    "title": "Orçamento para reforma"
  }'

# Resposta:
# { "conversation_id": "uuid-here" }
```

### Enviar Mensagem (SSE Streaming)

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "uuid-here",
    "agent_id": "orcamento",
    "message": "Quero orçar uma reforma de cozinha, 20m²"
  }'

# Resposta (streaming):
# data: {"type":"start","agent_id":"orcamento"}
# data: {"type":"token","content":"Vou"}
# data: {"type":"token","content":" analisar"}
# ...
# data: {"type":"complete","routing":{...},"cost_usd":0.0032}
```

### Enviar Feedback

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message_id": "uuid-here",
    "rating": 1,
    "notes": "Orçamento bem estruturado"
  }'
```

### Dashboard Observabilidade (admin only)

```bash
GET /api/admin/metrics?days=7
GET /api/admin/agent-performance?agent_id=orcamento
GET /api/admin/cost-by-model?days=7
GET /api/admin/feedback-summary?days=7
```

---

## 🔐 Segurança

### RLS (Row Level Security)

Todas as tabelas têm RLS ativa:

- `conversations`: Usuário só vê suas próprias conversas
- `ai_messages`: Acesso apenas se dono da conversa
- `ai_feedback`: Usuário só vê seu feedback
- `ai_metrics`: Admin only (view)
- `security_events`: Admin only (view)

### Anti-Injection (6 padrões detectados)

```typescript
✓ "ignore previous instructions"
✓ "reveal system prompt"
✓ "call tool" / "execute command"
✓ "api key reveal"
✓ "bypass guardrail"
✓ "localhost" / "metadata.google.internal"
```

### PII Masking Automático

```
Input:  "CPF do cliente: 123.456.789-10"
Output: "CPF do cliente: ***.***.***-**"
```

### Secrets Detection

- API keys (OpenAI, AWS, Supabase, etc)
- JWT tokens
- Private RSA keys
- Credit cards (Luhn)

---

## 📊 Observabilidade

### Métricas Coletadas

```
ai_request_started     → request_started
ai_request_completed   → latency_ms, tokens_in, tokens_out, cost_usd
ai_request_failed      → error_class, retry_count
ai_routing_emitted     → from_agent, to_agent, confidence
ai_routing_followed    → user aceitou handoff?
ai_guardrail_triggered → qual guardrail, qual ação
```

### Dashboard Admin

Acessar `/app/admin/system` (coming Sprint 2):

- **Requests**: Total, falhadas, latência p50/p95
- **Custo/dia**: Breakdown por modelo
- **Agentes**: Taxa sucesso, feedback +/-
- **Routing**: Aceitação de handoffs
- **Guardrails**: Top triggers

---

## 🧠 Exemplos de Saída

### Agente Orçamento

```json
{
  "disciplina": "civil",
  "cenarios": {
    "rapido": {
      "valor_brl": 15000,
      "prazo_dias": 15,
      "horas": 120,
      "margem_pct": 15,
      "riscos": [
        {
          "titulo": "Materiais com atraso",
          "mitigacao": "Pré-compra com 1 semana de antecedência"
        }
      ]
    },
    "normal": { ... },
    "premium": { ... }
  },
  "cenario_recomendado": "normal",
  "proximos_passos": ["Validar cronograma com cliente", "ART"]
}
```

### Agente Consultor Sênior

```json
{
  "disciplina": "eletrica",
  "diagnostico": "Projeto viável mas com risco de oversizing.",
  "riscos": [
    {
      "titulo": "Subestação subdimensionada",
      "probabilidade": "alta",
      "mitigacao": "Upgrade antes de ativação"
    }
  ],
  "alternativas": [
    {
      "titulo": "Padrão trifásico",
      "custo_relativo": "1x",
      "complexidade": "media"
    },
    {
      "titulo": "Monofásico + backup",
      "custo_relativo": "1.3x",
      "complexidade": "alta"
    }
  ],
  "recomendacao": "Recomendo trifásico. Custo inicial menor, operação mais robusta."
}
```

---

## 📈 Roadmap (3 Sprints)

### Sprint 1 ✅ COMPLETO

- [x] Camadas SYS-1..6 unificadas
- [x] Schemas Zod para todos agentes
- [x] Guardrails 7-layer
- [x] Database com RLS + pgvector
- [x] Edge function SSE streaming
- [x] Rate limiting
- [x] Métricas básicas

### Sprint 2 (Em Progresso)

- [ ] `response_format: json_schema` com Lovable
- [ ] Multi-modelo por agente (gpt-5, gemini-2.5-pro)
- [ ] Dashboard UI `/app/admin/system`
- [ ] Job semanal: feedback negativo → draft prompt
- [ ] Modo Crítica (revisão automática Sênior)

### Sprint 3 (Planejado)

- [ ] Slash commands (`/orcamento`, `/revisar`, `/exportar pdf`)
- [ ] Export para PDF (Puppeteer)
- [ ] Templates técnicos reutilizáveis
- [ ] Webhooks para integrações (Zapier, Make, etc)
- [ ] Mobile app (React Native)

---

## 🧪 Testes

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

---

## 🤝 Contribuindo

1. Fork o repo
2. Criar branch feature (`git checkout -b feature/nova-feature`)
3. Commit (`git commit -m 'feat: descrição'`)
4. Push (`git push origin feature/nova-feature`)
5. Abrir PR

---

## 📞 Suporte

- 📧 Email: support@engenheiro.ai
- 💬 Discord: [Link ao servidor]
- 📚 Docs: https://docs.engenheiro.ai
- 🐛 Issues: https://github.com/optmaiai/engenheiro-ai/issues

---

## 📄 Licença

MIT License — veja LICENSE.md

---

## 🎓 Créditos

Desenvolvido por **Optmai AI** para a comunidade de engenheiros brasileiros.

**Validação**: Esta plataforma é orientativa. Toda análise crítica deve ser validada por profissional habilitado (CREA).

---

**Status**: 🟢 Production-Ready (Sprint 1 com testes manual completos)  
**Última atualização**: 2026-05-07  
**Mantenedor**: optmaiai
