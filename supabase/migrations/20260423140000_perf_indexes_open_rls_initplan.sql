-- =============================================================================
-- Performance: índices alinhados às queries do app (Kanban, dashboard, timeline).
-- RLS: equipe pequena — qualquer usuário autenticado lê/edita leads e dados
--       relacionados; admin-only em export/import/perfis UPDATE.
--       Expressões (select auth.uid()) / (select fn_get_role()) evitam
--       reavaliação por linha (Supabase linter auth_rls_initplan).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Índices
-- ---------------------------------------------------------------------------

CREATE INDEX idx_leads_status_created_at ON public.leads (status, created_at DESC);

CREATE INDEX idx_historico_lead_created_at ON public.historico_interacoes (lead_id, created_at);

CREATE INDEX idx_perfis_role_status_nome ON public.perfis (role, status, nome_completo);

CREATE INDEX idx_importacoes_log_created_at ON public.importacoes_log (created_at DESC);

CREATE INDEX idx_exportacoes_log_created_at ON public.exportacoes_log (created_at DESC);

-- O composto (status, created_at) cobre filtros por status; o índice só em
-- status ficava redundante (e estava sem uso nas estatísticas do projeto).
DROP INDEX IF EXISTS idx_leads_status;

-- ---------------------------------------------------------------------------
-- 2. RLS — recria policies com initplan estável
-- ---------------------------------------------------------------------------

-- perfis
DROP POLICY IF EXISTS perfis_select ON public.perfis;
DROP POLICY IF EXISTS perfis_update_admin ON public.perfis;

CREATE POLICY perfis_select ON public.perfis FOR SELECT USING (
  (SELECT auth.uid()) IS NOT NULL
);

CREATE POLICY perfis_update_admin ON public.perfis FOR UPDATE USING (
  (SELECT fn_get_role()) = 'admin'
);

-- leads
DROP POLICY IF EXISTS leads_select ON public.leads;
DROP POLICY IF EXISTS leads_insert ON public.leads;
DROP POLICY IF EXISTS leads_update ON public.leads;

CREATE POLICY leads_select ON public.leads FOR SELECT USING (
  (SELECT auth.uid()) IS NOT NULL
);

CREATE POLICY leads_insert ON public.leads FOR INSERT WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
);

CREATE POLICY leads_update ON public.leads FOR UPDATE USING (
  (SELECT auth.uid()) IS NOT NULL
);

-- historico_interacoes
DROP POLICY IF EXISTS historico_select ON public.historico_interacoes;
DROP POLICY IF EXISTS historico_insert ON public.historico_interacoes;

CREATE POLICY historico_select ON public.historico_interacoes FOR SELECT USING (
  (SELECT auth.uid()) IS NOT NULL
);

CREATE POLICY historico_insert ON public.historico_interacoes FOR INSERT WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
);

-- documentos_lead
DROP POLICY IF EXISTS documentos_select ON public.documentos_lead;
DROP POLICY IF EXISTS documentos_insert ON public.documentos_lead;

CREATE POLICY documentos_select ON public.documentos_lead FOR SELECT USING (
  (SELECT auth.uid()) IS NOT NULL
);

CREATE POLICY documentos_insert ON public.documentos_lead FOR INSERT WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
);

-- pipeline_logs
DROP POLICY IF EXISTS pipeline_logs_select ON public.pipeline_logs;

CREATE POLICY pipeline_logs_select ON public.pipeline_logs FOR SELECT USING (
  (SELECT auth.uid()) IS NOT NULL
);

-- exportacoes_log
DROP POLICY IF EXISTS exportacoes_select ON public.exportacoes_log;
DROP POLICY IF EXISTS exportacoes_insert ON public.exportacoes_log;

CREATE POLICY exportacoes_select ON public.exportacoes_log FOR SELECT USING (
  (SELECT fn_get_role()) = 'admin'
);

CREATE POLICY exportacoes_insert ON public.exportacoes_log FOR INSERT WITH CHECK (
  (SELECT fn_get_role()) = 'admin'
);

-- importacoes_log
DROP POLICY IF EXISTS importacoes_select ON public.importacoes_log;
DROP POLICY IF EXISTS importacoes_insert ON public.importacoes_log;

CREATE POLICY importacoes_select ON public.importacoes_log FOR SELECT USING (
  (SELECT fn_get_role()) = 'admin'
);

CREATE POLICY importacoes_insert ON public.importacoes_log FOR INSERT WITH CHECK (
  (SELECT fn_get_role()) = 'admin'
);

-- ---------------------------------------------------------------------------
-- 3. Storage — documentos-leads: qualquer autenticado; pasta = lead existente
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS storage_select ON storage.objects;
DROP POLICY IF EXISTS storage_insert ON storage.objects;

CREATE POLICY storage_select ON storage.objects FOR SELECT USING (
  bucket_id = 'documentos-leads'
  AND (SELECT auth.uid()) IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.leads
    WHERE leads.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY storage_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'documentos-leads'
  AND (SELECT auth.uid()) IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.leads
    WHERE leads.id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS storage_delete_admin ON storage.objects;

CREATE POLICY storage_delete_admin ON storage.objects FOR DELETE USING (
  bucket_id = 'documentos-leads'
  AND (SELECT fn_get_role()) = 'admin'
);
