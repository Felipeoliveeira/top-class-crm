-- =============================================================================
-- VALIDAÇÃO DA FASE 1 — Fundação Backend
-- =============================================================================
-- Execute via Supabase MCP (execute_sql) ou SQL Editor do Dashboard.
-- Cada bloco retorna uma linha com o teste e o resultado (PASS/FAIL).
-- Se todos retornarem PASS, a Fase 1 está 100% validada.
--
-- Referências: PLANO-IMPLEMENTACAO.md, Epics 1.1–1.4
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Epic 1.1 — Tabelas e Enums
-- ─────────────────────────────────────────────────────────────────────────────

-- S-1.1.1: Todas as 6 tabelas existem com RLS ativo
SELECT
  'S-1.1.1 Tabelas com RLS' AS teste,
  CASE
    WHEN COUNT(*) = 6 THEN 'PASS'
    ELSE 'FAIL — esperado 6, encontrado ' || COUNT(*)::text
  END AS resultado
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = 'public'::regnamespace
WHERE t.schemaname = 'public'
  AND t.tablename IN ('perfis','leads','historico_interacoes','documentos_lead','pipeline_logs','exportacoes_log')
  AND c.relrowsecurity = true;

-- S-1.1.2: Todos os 9 enums existem
SELECT
  'S-1.1.2 Enums do PRD' AS teste,
  CASE
    WHEN COUNT(DISTINCT t.typname) = 9 THEN 'PASS'
    ELSE 'FAIL — esperado 9, encontrado ' || COUNT(DISTINCT t.typname)::text
  END AS resultado
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.typname IN (
    'role_enum','status_usuario_enum','status_lead_enum','origem_enum',
    'necessidade_enum','servico_enum','status_financeiro_enum',
    'motivo_perda_enum','formato_doc_enum'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Epic 1.2 — Políticas RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- S-1.2.1: leads tem 4 policies (select, insert, update, delete_deny)
SELECT
  'S-1.2.1 RLS leads' AS teste,
  CASE
    WHEN COUNT(*) = 4 THEN 'PASS'
    ELSE 'FAIL — esperado 4 policies, encontrado ' || COUNT(*)::text
  END AS resultado
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'leads';

-- S-1.2.2: historico_interacoes tem 4 policies (select, insert, update_deny, delete_deny)
SELECT
  'S-1.2.2 RLS historico_interacoes' AS teste,
  CASE
    WHEN COUNT(*) = 4 THEN 'PASS'
    ELSE 'FAIL — esperado 4 policies, encontrado ' || COUNT(*)::text
  END AS resultado
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'historico_interacoes';

-- S-1.2.2b: historico_interacoes deny policies bloqueiam UPDATE e DELETE
SELECT
  'S-1.2.2b historico imutavel' AS teste,
  CASE
    WHEN COUNT(*) = 2 THEN 'PASS'
    ELSE 'FAIL — deny policies faltando'
  END AS resultado
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'historico_interacoes'
  AND policyname LIKE '%deny%'
  AND qual = 'false';

-- S-1.2.3: pipeline_logs somente leitura (4 policies, insert/update/delete deny)
SELECT
  'S-1.2.3 RLS pipeline_logs' AS teste,
  CASE
    WHEN COUNT(*) = 3 THEN 'PASS'
    ELSE 'FAIL — esperado 3 deny policies, encontrado ' || COUNT(*)::text
  END AS resultado
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'pipeline_logs'
  AND policyname LIKE '%deny%';

-- S-1.2.4: documentos_lead (4 policies)
SELECT
  'S-1.2.4 RLS documentos_lead' AS teste,
  CASE
    WHEN COUNT(*) = 4 THEN 'PASS'
    ELSE 'FAIL — esperado 4 policies, encontrado ' || COUNT(*)::text
  END AS resultado
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'documentos_lead';

-- S-1.2.5: exportacoes_log (4 policies, admin only)
SELECT
  'S-1.2.5 RLS exportacoes_log' AS teste,
  CASE
    WHEN COUNT(*) = 4 THEN 'PASS'
    ELSE 'FAIL — esperado 4 policies, encontrado ' || COUNT(*)::text
  END AS resultado
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'exportacoes_log';

-- S-1.2.6: perfis (2 policies: select, update_admin)
SELECT
  'S-1.2.6 RLS perfis' AS teste,
  CASE
    WHEN COUNT(*) = 2 THEN 'PASS'
    ELSE 'FAIL — esperado 2 policies, encontrado ' || COUNT(*)::text
  END AS resultado
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'perfis';

-- ─────────────────────────────────────────────────────────────────────────────
-- Epic 1.3 — Triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- S-1.3.1: triggers de pipeline_log em leads (INSERT e UPDATE)
SELECT
  'S-1.3.1 Triggers pipeline_log' AS teste,
  CASE
    WHEN COUNT(*) = 2 THEN 'PASS'
    ELSE 'FAIL — esperado 2 triggers pipeline, encontrado ' || COUNT(*)::text
  END AS resultado
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'leads'
  AND trigger_name LIKE 'trg_pipeline_log%';

-- S-1.3.2: triggers de ultima_movimentacao (leads UPDATE + historico INSERT)
SELECT
  'S-1.3.2 Triggers ultima_movimentacao' AS teste,
  CASE
    WHEN COUNT(*) = 2 THEN 'PASS'
    ELSE 'FAIL — esperado 2 triggers movimentacao, encontrado ' || COUNT(*)::text
  END AS resultado
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_ultima_movimentacao%';

-- S-1.3.3: triggers de updated_at (leads + perfis)
SELECT
  'S-1.3.3 Triggers updated_at' AS teste,
  CASE
    WHEN COUNT(*) = 2 THEN 'PASS'
    ELSE 'FAIL — esperado 2 triggers updated_at, encontrado ' || COUNT(*)::text
  END AS resultado
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_updated_at%';

-- ─────────────────────────────────────────────────────────────────────────────
-- Epic 1.4 — Supabase Storage
-- ─────────────────────────────────────────────────────────────────────────────

-- S-1.4.1: Bucket documentos-leads existe, privado, 10MB, MIME corretos
SELECT
  'S-1.4.1 Bucket documentos-leads' AS teste,
  CASE
    WHEN COUNT(*) = 1 THEN 'PASS'
    ELSE 'FAIL — bucket não encontrado com configuração correta'
  END AS resultado
FROM storage.buckets
WHERE id = 'documentos-leads'
  AND public = false
  AND file_size_limit = 10485760
  AND allowed_mime_types @> ARRAY[
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'application/pdf'
  ]::text[];

-- S-1.4.1b: Storage policies (4: select, insert, update_deny, delete_deny)
SELECT
  'S-1.4.1b Storage policies' AS teste,
  CASE
    WHEN COUNT(*) = 4 THEN 'PASS'
    ELSE 'FAIL — esperado 4 storage policies, encontrado ' || COUNT(*)::text
  END AS resultado
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

-- ─────────────────────────────────────────────────────────────────────────────
-- Funções PostgreSQL
-- ─────────────────────────────────────────────────────────────────────────────

-- Todas as 7 funções existem
SELECT
  'Funcoes PostgreSQL' AS teste,
  CASE
    WHEN COUNT(*) = 7 THEN 'PASS'
    ELSE 'FAIL — esperado 7 funcoes, encontrado ' || COUNT(*)::text
  END AS resultado
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'fn_get_role','fn_criar_perfil_novo_usuario','fn_pipeline_log',
    'fn_pipeline_log_insert','fn_set_updated_at',
    'fn_ultima_movimentacao_status','fn_ultima_movimentacao_interacao'
  );

-- Todas as funções têm search_path configurado
SELECT
  'Funcoes search_path' AS teste,
  CASE
    WHEN COUNT(*) = 0 THEN 'PASS'
    ELSE 'FAIL — ' || COUNT(*)::text || ' funcao(oes) sem search_path'
  END AS resultado
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE 'fn_%'
  AND NOT (p.proconfig @> ARRAY['search_path=public']);

-- ─────────────────────────────────────────────────────────────────────────────
-- Edge Function
-- ─────────────────────────────────────────────────────────────────────────────
-- (Não verificável via SQL — confirmar via Supabase MCP list_edge_functions)

-- ─────────────────────────────────────────────────────────────────────────────
-- RESUMO
-- ─────────────────────────────────────────────────────────────────────────────
-- Total de verificações: 16 queries
-- Se todos retornarem PASS → Fase 1 está 100% validada e pronta para Fase 2.
