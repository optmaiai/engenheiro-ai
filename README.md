# Engenheiro.AI — Sistema de IA para Engenheiros PJ

![Status](https://img.shields.io/badge/status-MVP%20fullstack-blue) ![Language](https://img.shields.io/badge/language-TypeScript-blue) ![Database](https://img.shields.io/badge/database-Supabase-darkblue)

Sistema inteligente de orquestração de agentes IA especializado para engenheiros brasileiros operando como Pessoa Jurídica (PJ) no regime Simples Nacional.

## O que está implementado

- Next.js 16 com landing page responsiva e catálogo dos 6 agentes.
- API `POST /api/chat` com autenticação Supabase JWT, rate limit opcional Upstash, camadas de prompt, Lovable AI Gateway, guardrails, persistência e métricas.
- API `GET/POST /api/conversations` para histórico básico e `GET/PATCH/DELETE /api/conversations/:id` para detalhe, edição e arquivamento lógico.
- API `GET/PUT /api/profile` para memória técnica do engenheiro.
- API `GET/POST /api/conversations/:id/attachments` e `GET /api/attachments/:id/chunks` para ingestão textual e busca simples em anexos/RAG.
- API `POST /api/feedback` para loop de avaliação.
- API `GET /api/metrics` e `GET/POST/PATCH /api/admin/prompts` para administração com allowlist `ADMIN_EMAILS`.
- Supabase migration com conversas, mensagens, feedback, prompts versionados, perfis, anexos/RAG, métricas, eventos de segurança, views `security_invoker` e notificações.
- Edge Function `chat-stream` como base SSE para deploy no Supabase.

## Agentes

| Agente | Especialidade | Saída |
|---|---|---|
| Orçamento Técnico | Formação de preço em 3 cenários | JSON estruturado + riscos |
| Admin Financeiro PJ | DAS, ISS, fluxo de caixa, KPIs | Relatório executivo mensal |
| Consultor de Normas | NBR, NR, IEC, ASME | Checklist normativo |
| Consultor Sênior | Análise crítica e alternativas | Diagnóstico + recomendação |
| Comunicação Pro | E-mails, propostas, mensagens | 3 versões de comunicação |
| Planejamento & Execução | GTD, Kanban, PERT/CPM | Plano semanal e backlog |

## Arquitetura de prompt

Cada chamada monta 6 camadas determinísticas:

1. Identidade e missão.
2. Política de segurança anti-injection/anti-exfiltração.
3. Protocolo de roteamento `ROUTING: {...}`.
4. Persona versionada em `agent_prompts`.
5. Perfil técnico do usuário.
6. Contexto da sessão e histórico recente.

## Guardrails pós-LLM

O pipeline em `src/server/ai-output-guards.ts` executa:

1. Mascaramento de CPF/CNPJ, conta e agência.
2. Bloqueio de segredos e tokens.
3. Detecção de cartão por Luhn.
4. Tamanho mínimo para agentes técnicos.
5. Disclaimer obrigatório para áreas sensíveis.
6. Validação JSON opcional por Zod.
7. Normalização de roteamento.

## Quick start

```bash
npm install
cp .env.example .env.local # crie manualmente se necessário
npm run dev
```

Variáveis de ambiente:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
LOVABLE_AI_KEY=your-lovable-key
LOVABLE_AI_GATEWAY_URL=https://ai.gateway.lovable.dev/v1/chat/completions
ADMIN_EMAILS=adminmaster@engenheiro.ai
```

Sem `LOVABLE_AI_KEY`, o backend retorna uma resposta demonstrativa para facilitar desenvolvimento local.

## Comandos

```bash
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
npm run check:static
```

## Testes automatizados

A suíte unitária cobre guardrails, schemas críticos e helpers RAG com Vitest. O sanity check valida invariantes estáticos de rotas, SQL e hardening antes de deploy.

```bash
npm test
npm run check:static
```

## Deploy

```bash
npx supabase migration up
supabase functions deploy chat-stream
vercel deploy
```

## Interface operacional

Além da landing page, o MVP inclui `/dashboard` para testar chat, histórico e status de conversas, feedback, perfil técnico, ingestão e busca de chunks em anexos RAG, gestão de versões de prompts admin e métricas administrativas usando um JWT Supabase do usuário.

## API

### Criar conversa

```bash
curl -X POST http://localhost:3000/api/conversations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"orcamento","title":"Orçamento reforma"}'
```

### Ler/editar conversa

```bash
curl -X GET "http://localhost:3000/api/conversations/UUID?limit=30" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

curl -X PATCH http://localhost:3000/api/conversations/UUID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Novo título","status":"archived"}'
```

### Perfil técnico

```bash
curl -X PUT http://localhost:3000/api/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"crea_uf":"SP","especialidades":["estruturas"],"hora_tecnica_brl":250}'
```

### Anexos e RAG textual

```bash
curl -X POST http://localhost:3000/api/conversations/UUID/attachments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"memorial.txt","file_type":"txt","content":"Texto extraído do memorial de cálculo..."}'

curl -X GET "http://localhost:3000/api/attachments/ATTACHMENT_UUID/chunks?q=carga%20vento&limit=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Prompts administrativos

```bash
curl -X GET "http://localhost:3000/api/admin/prompts?agent_id=orcamento" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"

curl -X POST http://localhost:3000/api/admin/prompts \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"orcamento","title":"Orçamento Técnico v2","content":"Prompt completo com mais de cinquenta caracteres...","is_active":true}'

curl -X PATCH http://localhost:3000/api/admin/prompts/PROMPT_UUID \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active":true,"notes":"Ativado após revisão"}'
```

### Enviar mensagem

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"conversation_id":"UUID","agent_id":"senior","message":"Revise os riscos desta proposta."}'
```

## Hardening recente

- Mensagens, detalhes de conversa, perfil e feedback agora verificam propriedade da conversa/mensagem/usuário no backend antes de operações via service role.
- Roteamento emitido pelo modelo é validado e normalizado antes de persistir ou gerar métricas.
- Métricas brutas permanecem service-role only; admins acessam agregados e versionamento de prompts pela API protegida por `ADMIN_EMAILS`.
- A RPC `get_conversation_with_history` respeita `auth.uid()` e limita o histórico retornado.
- O chat injeta no SYS-6 os trechos de anexos mais relevantes por busca lexical local antes da resposta do agente.
