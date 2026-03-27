-- =============================================================================
-- MIGRATION: Políticas RLS de bloqueio explícito (deny)
-- =============================================================================
-- O RLS ativo sem policy já bloqueia a operação por padrão. Estas policies
-- adicionam uma camada explícita de defesa em profundidade conforme exigido
-- pelo PRD Seção 6.4 e pelas regras do projeto.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- leads: DELETE proibido para todos (PRD: "Não permitido")
-- ---------------------------------------------------------------------------
CREATE POLICY leads_delete_deny ON leads
  FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- historico_interacoes: UPDATE e DELETE proibidos (imutabilidade — PRD RF-20, RNF-11)
-- ---------------------------------------------------------------------------
CREATE POLICY historico_update_deny ON historico_interacoes
  FOR UPDATE USING (false);

CREATE POLICY historico_delete_deny ON historico_interacoes
  FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- documentos_lead: UPDATE e DELETE proibidos (PRD Seção 6.4)
-- ---------------------------------------------------------------------------
CREATE POLICY documentos_update_deny ON documentos_lead
  FOR UPDATE USING (false);

CREATE POLICY documentos_delete_deny ON documentos_lead
  FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- pipeline_logs: INSERT, UPDATE e DELETE proibidos via RLS
-- (INSERT ocorre apenas via trigger SECURITY DEFINER que bypassa RLS)
-- ---------------------------------------------------------------------------
CREATE POLICY pipeline_logs_insert_deny ON pipeline_logs
  FOR INSERT WITH CHECK (false);

CREATE POLICY pipeline_logs_update_deny ON pipeline_logs
  FOR UPDATE USING (false);

CREATE POLICY pipeline_logs_delete_deny ON pipeline_logs
  FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- exportacoes_log: UPDATE e DELETE proibidos (PRD Seção 6.4)
-- ---------------------------------------------------------------------------
CREATE POLICY exportacoes_update_deny ON exportacoes_log
  FOR UPDATE USING (false);

CREATE POLICY exportacoes_delete_deny ON exportacoes_log
  FOR DELETE USING (false);
