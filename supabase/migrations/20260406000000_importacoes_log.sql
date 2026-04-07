-- =============================================================================
-- MIGRATION: importacoes_log
-- Tabela de auditoria de importações CSV em massa (admin only)
-- =============================================================================

CREATE TABLE importacoes_log (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  importado_por   uuid    NOT NULL REFERENCES perfis(id),
  total_registros integer NOT NULL,
  total_sucesso   integer NOT NULL,
  total_erros     integer NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_importacoes_log_importado_por ON importacoes_log (importado_por);

-- RLS
ALTER TABLE importacoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY importacoes_select ON importacoes_log FOR SELECT USING (
  fn_get_role() = 'admin'
);
CREATE POLICY importacoes_insert ON importacoes_log FOR INSERT WITH CHECK (
  fn_get_role() = 'admin'
);
CREATE POLICY importacoes_update_deny ON importacoes_log FOR UPDATE USING (false);
CREATE POLICY importacoes_delete_deny ON importacoes_log FOR DELETE USING (false);
