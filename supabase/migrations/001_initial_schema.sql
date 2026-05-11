-- ========================================================================
-- ENGENHEIRO.AI — Initial Schema with RLS, pgvector, Views, RPCs
-- Generated: 2026-05-07
-- ========================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
-- pg_cron is optional and may not be enabled on every Supabase project.
-- CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ========================================================================
-- TABLE 1: Conversations (owns everything)
-- ========================================================================

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  agent_id VARCHAR(50) NOT NULL DEFAULT 'comunicacao',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations_owner" ON public.conversations 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_agent_id ON public.conversations(agent_id);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at DESC);

-- ========================================================================
-- TABLE 2: AI Messages (streaming + structured output)
-- ========================================================================

CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id VARCHAR(50) NOT NULL,
  model VARCHAR(100),
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  structured_output JSONB,
  routing_json JSONB,
  citations TEXT[],
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER,
  cost_usd DECIMAL(10, 6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_messages_owner" ON public.ai_messages
  FOR ALL USING (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  );
CREATE INDEX idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX idx_ai_messages_user_id ON public.ai_messages(user_id);
CREATE INDEX idx_ai_messages_created_at ON public.ai_messages(created_at DESC);
CREATE INDEX idx_ai_messages_agent_id ON public.ai_messages(agent_id);

-- ========================================================================
-- TABLE 3: AI Feedback (rating + corrections for loop learning)
-- ========================================================================

CREATE TABLE public.ai_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.ai_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id VARCHAR(50) NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 0, 1)),
  notes TEXT,
  corrections TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_feedback_owner" ON public.ai_feedback
  FOR ALL USING (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.ai_messages m
      WHERE m.id = ai_feedback.message_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.ai_messages m
      WHERE m.id = ai_feedback.message_id AND m.user_id = auth.uid()
    )
  );
CREATE INDEX idx_ai_feedback_agent_id ON public.ai_feedback(agent_id);
CREATE INDEX idx_ai_feedback_rating ON public.ai_feedback(rating);
CREATE INDEX idx_ai_feedback_created_at ON public.ai_feedback(created_at DESC);

-- ========================================================================
-- TABLE 4: Agent Prompts (versionable, single active per agent)
-- ========================================================================

CREATE TABLE public.agent_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id VARCHAR(50) NOT NULL,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  model_override VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(agent_id, version)
);

ALTER TABLE public.agent_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_prompts_admin" ON public.agent_prompts
  FOR ALL USING (auth.jwt() ->> 'email' = 'adminmaster@engenheiro.ai')
  WITH CHECK (auth.jwt() ->> 'email' = 'adminmaster@engenheiro.ai');
CREATE INDEX idx_agent_prompts_agent_id ON public.agent_prompts(agent_id);
CREATE INDEX idx_agent_prompts_is_active ON public.agent_prompts(is_active);

-- Trigger: Ensure only 1 active prompt per agent
CREATE OR REPLACE FUNCTION ensure_single_active_agent_prompt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active THEN
    UPDATE public.agent_prompts 
    SET is_active = FALSE 
    WHERE agent_id = NEW.agent_id AND id != NEW.id AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_single_active_agent_prompt
AFTER INSERT OR UPDATE ON public.agent_prompts
FOR EACH ROW
EXECUTE FUNCTION ensure_single_active_agent_prompt();

-- ========================================================================
-- TABLE 5: User Engineer Profile (long-term memory)
-- ========================================================================

CREATE TABLE public.user_engineer_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  crea_uf VARCHAR(2),
  crea_numero VARCHAR(20),
  especialidades TEXT[] DEFAULT '{}',
  regime_tributario VARCHAR(50) DEFAULT 'simples_nacional',
  faixa_simples VARCHAR(20),
  bdi_padrao_pct DECIMAL(5, 2),
  hora_tecnica_brl DECIMAL(10, 2),
  cidade TEXT,
  estado VARCHAR(2),
  preferencias_normativas TEXT[] DEFAULT '{}',
  estilo_comunicacao VARCHAR(50) DEFAULT 'tecnico_cordial',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_engineer_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_profile_own" ON public.user_engineer_profile
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========================================================================
-- TABLE 6: Attachments (PDF, DOCX metadata)
-- ========================================================================

CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type VARCHAR(20),
  file_size_bytes BIGINT,
  storage_path TEXT,
  extracted_pages INTEGER,
  chunks_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments_owner" ON public.attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.conversations c 
      WHERE c.id = attachments.conversation_id AND c.user_id = auth.uid()
    )
  );
CREATE INDEX idx_attachments_conversation_id ON public.attachments(conversation_id);
CREATE INDEX idx_attachments_created_at ON public.attachments(created_at DESC);

-- ========================================================================
-- TABLE 7: Attachment Chunks (with pgvector for RAG)
-- ========================================================================

CREATE TABLE public.attachment_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attachment_id UUID NOT NULL REFERENCES public.attachments(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  page_number INTEGER,
  char_start INTEGER,
  char_end INTEGER,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attachment_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachment_chunks_owner" ON public.attachment_chunks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.attachments a 
      JOIN public.conversations c ON c.id = a.conversation_id
      WHERE a.id = attachment_chunks.attachment_id AND c.user_id = auth.uid()
    )
  );
CREATE INDEX idx_attachment_chunks_attachment_id ON public.attachment_chunks(attachment_id);
CREATE INDEX idx_attachment_chunks_embedding ON public.attachment_chunks 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RPC: Vector similarity search
CREATE OR REPLACE FUNCTION public.search_attachment_chunks(
  p_conversation_id UUID,
  p_query_embedding VECTOR,
  p_limit INT DEFAULT 6
)
RETURNS TABLE (
  attachment_id UUID,
  chunk_index INT,
  content TEXT,
  page_number INT,
  similarity FLOAT8
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ac.attachment_id,
    ac.chunk_index,
    ac.content,
    ac.page_number,
    1 - (ac.embedding <=> p_query_embedding) AS similarity
  FROM public.attachment_chunks ac
  JOIN public.attachments a ON a.id = ac.attachment_id
  WHERE a.conversation_id = p_conversation_id AND ac.embedding IS NOT NULL
  ORDER BY ac.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ========================================================================
-- TABLE 8: AI Metrics (observability)
-- ========================================================================

CREATE TABLE public.ai_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL,
  agent_id VARCHAR(50),
  model VARCHAR(100),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  latency_ms INTEGER,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd DECIMAL(10, 6),
  error_class VARCHAR(100),
  error_message TEXT,
  retry_count SMALLINT,
  from_agent VARCHAR(50),
  to_agent VARCHAR(50),
  routing_confidence DECIMAL(3, 2),
  user_accepted BOOLEAN,
  guard_name VARCHAR(100),
  guard_action VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No RLS on metrics — admin only but GRANT handled separately
CREATE INDEX idx_ai_metrics_event_type ON public.ai_metrics(event_type);
CREATE INDEX idx_ai_metrics_agent_id ON public.ai_metrics(agent_id);
CREATE INDEX idx_ai_metrics_created_at ON public.ai_metrics(created_at DESC);
CREATE INDEX idx_ai_metrics_conversation_id ON public.ai_metrics(conversation_id);

-- ========================================================================
-- TABLE 9: Security Events (audit trail)
-- ========================================================================

CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_events_severity ON public.security_events(severity);
CREATE INDEX idx_security_events_created_at ON public.security_events(created_at DESC);
CREATE INDEX idx_security_events_event_type ON public.security_events(event_type);

-- ========================================================================
-- VIEW 1: Agent Feedback Summary
-- ========================================================================

CREATE OR REPLACE VIEW public.vw_agent_feedback_summary
WITH (security_invoker = true) AS
SELECT 
  agent_id,
  COUNT(*) as total_feedback,
  COUNT(CASE WHEN rating = 1 THEN 1 END) as positive_count,
  COUNT(CASE WHEN rating = 0 THEN 1 END) as neutral_count,
  COUNT(CASE WHEN rating = -1 THEN 1 END) as negative_count,
  ROUND(100.0 * COUNT(CASE WHEN rating = 1 THEN 1 END) / COUNT(*), 2) as positive_pct,
  ROUND(100.0 * COUNT(CASE WHEN rating = -1 THEN 1 END) / COUNT(*), 2) as negative_pct,
  DATE(created_at) as feedback_date
FROM public.ai_feedback
GROUP BY agent_id, DATE(created_at)
ORDER BY feedback_date DESC, agent_id;

-- ========================================================================
-- VIEW 2: Daily AI Costs
-- ========================================================================

CREATE OR REPLACE VIEW public.vw_daily_ai_costs
WITH (security_invoker = true) AS
SELECT 
  DATE(created_at) as cost_date,
  agent_id,
  model,
  COUNT(*) as requests,
  SUM(cost_usd) as total_cost_usd,
  AVG(latency_ms) as avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms
FROM public.ai_messages
WHERE role = 'assistant'
GROUP BY DATE(created_at), agent_id, model
ORDER BY cost_date DESC;

-- ========================================================================
-- TABLE 10: Conversation History Cache (optimization)
-- ========================================================================

CREATE TABLE public.conversation_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  key_topics TEXT[],
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id)
);

ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversation_summaries_owner" ON public.conversation_summaries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.conversations c 
      WHERE c.id = conversation_summaries.conversation_id AND c.user_id = auth.uid()
    )
  );

-- ========================================================================
-- TABLE 11: Notification Center (for draft prompts, alerts)
-- ========================================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_owner" ON public.notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- ========================================================================
-- UTILITY FUNCTIONS
-- ========================================================================

-- RPC: Get conversation with history
CREATE OR REPLACE FUNCTION public.get_conversation_with_history(
  p_conversation_id UUID,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  conversation_id UUID,
  title TEXT,
  agent_id VARCHAR,
  messages JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.agent_id,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', limited_messages.id,
          'role', limited_messages.role,
          'content', limited_messages.content,
          'structured_output', limited_messages.structured_output,
          'routing_json', limited_messages.routing_json,
          'created_at', limited_messages.created_at
        )
        ORDER BY limited_messages.created_at ASC
      ) FILTER (WHERE limited_messages.id IS NOT NULL),
      '[]'::JSONB
    ) AS messages
  FROM public.conversations c
  LEFT JOIN LATERAL (
    SELECT m.id, m.role, m.content, m.structured_output, m.routing_json, m.created_at
    FROM public.ai_messages m
    WHERE m.conversation_id = c.id AND m.user_id = auth.uid()
    ORDER BY m.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  ) limited_messages ON TRUE
  WHERE c.id = p_conversation_id AND c.user_id = auth.uid()
  GROUP BY c.id, c.title, c.agent_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ========================================================================
-- GRANTS (for service role)
-- ========================================================================

-- Metrics and security events should remain service-role/admin mediated by API routes.
-- GRANT SELECT ON public.ai_metrics TO authenticated;
-- GRANT SELECT ON public.security_events TO authenticated;
GRANT SELECT ON public.vw_agent_feedback_summary TO authenticated;
GRANT SELECT ON public.vw_daily_ai_costs TO authenticated;

-- Agent prompt writes are still constrained by the admin-only RLS policy above.
GRANT ALL ON public.agent_prompts TO authenticated;
-- ai_metrics remains service-role only; expose aggregates via authenticated admin API routes.

-- ========================================================================
-- INITIAL DATA (Default Agent Prompts)
-- ========================================================================

INSERT INTO public.agent_prompts (agent_id, version, title, content, is_active) VALUES
('orcamento', 1, 'Orçamento Técnico v1', 'Você é o Orçamento Técnico — engenheiro sênior formando preço para PJ...', TRUE),
('admin_financeiro', 1, 'Admin Financeiro PJ v1', 'Você é o Admin Financeiro PJ — consultor financeiro...', TRUE),
('normas', 1, 'Consultor de Normas v1', 'Você é o Consultor de Normas (ABNT NBR, NR, IEC, ASME)...', TRUE),
('senior', 1, 'Consultor Sênior v1', 'Você é o Consultor Sênior — 30 anos, advogado do diabo técnico...', TRUE),
('comunicacao', 1, 'Comunicação Pro v1', 'Você é o Comunicação Pro — escrita profissional para engenharia...', TRUE),
('planejamento', 1, 'Planejamento & Execução v1', 'Você é o Planejamento & Execução (GTD + Kanban + PERT/CPM)...', TRUE);

-- ========================================================================
-- REFRESH VIEWS
-- ========================================================================

-- Views above are regular views, not materialized views; no refresh is required.
