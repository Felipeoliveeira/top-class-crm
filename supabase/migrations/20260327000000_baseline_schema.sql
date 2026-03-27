-- =============================================================================
-- BASELINE MIGRATION — CRM Top Class
-- =============================================================================
-- Captura o schema completo do banco de produção em 27/03/2026.
-- Esta migration serve como ponto de partida para versionamento local.
-- Referência: PRD-CRM-TopClass v1.1, Seção 6.2
--
-- NOTA DE CONSOLIDAÇÃO (27/03/2026):
-- Este baseline já incorpora todos os fixes aplicados ao banco remoto:
--   - fix_function_search_path: SET search_path em todas as funções
--   - fix_rls_auth_uid_initplan: (SELECT auth.uid()) nas policies RLS
--   - add_missing_fk_indexes: índices em todas as colunas FK
--   - rls_explicit_deny_policies: policies de deny explícito
--   - storage_bucket_config: bucket documentos-leads com limites
-- Não existem migrations incrementais — tudo está neste arquivo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------------

CREATE TYPE role_enum AS ENUM ('admin', 'consultor');
CREATE TYPE status_usuario_enum AS ENUM ('ativo', 'inativo');
CREATE TYPE status_lead_enum AS ENUM ('atendimento', 'negociacao', 'fechado', 'perdido', 'inativo');
CREATE TYPE origem_enum AS ENUM ('indicacao', 'google', 'placa', 'rede_social');
CREATE TYPE necessidade_enum AS ENUM ('escritorio_virtual', 'salas', 'endereco_fiscal', 'coworking');
CREATE TYPE servico_enum AS ENUM (
  'plano_pro', 'plano_premium', 'plano_top', 'coworking',
  'sala_special_room', 'mini_sala_reuniao', 'sala_reuniao_8',
  'sala_reuniao_12', 'salas_fixas'
);
CREATE TYPE status_financeiro_enum AS ENUM ('pago', 'pendente');
CREATE TYPE motivo_perda_enum AS ENUM ('parou_responder', 'sem_interesse', 'preco', 'concorrencia', 'outro');
CREATE TYPE formato_doc_enum AS ENUM ('doc', 'docx', 'jpg', 'pdf');

-- ---------------------------------------------------------------------------
-- 2. TABELAS
-- ---------------------------------------------------------------------------

-- perfis: perfil do usuário autenticado (1:1 com auth.users)
CREATE TABLE perfis (
  id            uuid            PRIMARY KEY REFERENCES auth.users(id),
  nome_completo text            NOT NULL,
  email         text            NOT NULL UNIQUE,
  role          role_enum       NOT NULL,
  status        status_usuario_enum NOT NULL DEFAULT 'ativo',
  ultimo_acesso timestamptz,
  avatar_url    text,
  created_at    timestamptz     NOT NULL DEFAULT now(),
  updated_at    timestamptz     NOT NULL DEFAULT now()
);

-- leads: dados do lead e estágio no pipeline
CREATE TABLE leads (
  id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consultor_id            uuid            NOT NULL REFERENCES perfis(id),
  nome                    text            NOT NULL,
  telefone                text            NOT NULL,
  origem                  origem_enum,
  necessidade             necessidade_enum,
  status                  status_lead_enum NOT NULL DEFAULT 'atendimento',
  servico_interesse       servico_enum,
  valor_bruto             numeric(10,2),
  porcentagem_desconto    numeric(5,2)    CHECK (porcentagem_desconto IS NULL OR (porcentagem_desconto >= 0.01 AND porcentagem_desconto <= 100)),
  valor_liquido           numeric(10,2),
  email                   text,
  rg                      text,
  cpf                     text,
  cnpj                    text,
  razao_social            text,
  contato_numero          text,
  socios                  jsonb,
  status_financeiro       status_financeiro_enum,
  data_prevista_pagamento smallint        CHECK (data_prevista_pagamento IS NULL OR (data_prevista_pagamento >= 1 AND data_prevista_pagamento <= 31)),
  motivo_perda_tipo       motivo_perda_enum,
  motivo_perda_descricao  text,
  created_at              timestamptz     NOT NULL DEFAULT now(),
  updated_at              timestamptz     NOT NULL DEFAULT now(),
  ultima_movimentacao_at  timestamptz
);

-- historico_interacoes: registro imutável de interações por lead
CREATE TABLE historico_interacoes (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id    bigint      NOT NULL REFERENCES leads(id),
  autor_id   uuid        NOT NULL REFERENCES perfis(id),
  anotacao   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- documentos_lead: metadados de documentos armazenados no Supabase Storage
CREATE TABLE documentos_lead (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id        bigint           NOT NULL REFERENCES leads(id),
  uploaded_by    uuid             NOT NULL REFERENCES perfis(id),
  nome_descricao text             NOT NULL,
  arquivo_url    text             NOT NULL,
  formato        formato_doc_enum NOT NULL,
  tamanho_bytes  integer,
  created_at     timestamptz      NOT NULL DEFAULT now()
);

-- pipeline_logs: log imutável de movimentações de status (inserção apenas via trigger)
CREATE TABLE pipeline_logs (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id         bigint      NOT NULL REFERENCES leads(id),
  executado_por   uuid        NOT NULL REFERENCES perfis(id),
  status_anterior text,
  status_novo     text        NOT NULL,
  observacao      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- exportacoes_log: auditoria de exportações CSV (admin only)
CREATE TABLE exportacoes_log (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exportado_por    uuid    NOT NULL REFERENCES perfis(id),
  total_registros  integer NOT NULL,
  filtros_aplicados jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. ÍNDICES
-- ---------------------------------------------------------------------------

CREATE INDEX idx_leads_consultor_id ON leads (consultor_id);
CREATE INDEX idx_leads_status ON leads (status);
CREATE INDEX idx_leads_created_at ON leads (created_at DESC);

CREATE INDEX idx_historico_lead_id ON historico_interacoes (lead_id);
CREATE INDEX idx_historico_interacoes_autor_id ON historico_interacoes (autor_id);

CREATE INDEX idx_documentos_lead_id ON documentos_lead (lead_id);
CREATE INDEX idx_documentos_lead_uploaded_by ON documentos_lead (uploaded_by);

CREATE INDEX idx_pipeline_logs_lead_id ON pipeline_logs (lead_id);
CREATE INDEX idx_pipeline_logs_executado_por ON pipeline_logs (executado_por);

CREATE INDEX idx_exportacoes_log_exportado_por ON exportacoes_log (exportado_por);

-- ---------------------------------------------------------------------------
-- 4. FUNÇÕES
-- ---------------------------------------------------------------------------

-- Retorna o role do usuário autenticado (usado nas policies RLS)
CREATE OR REPLACE FUNCTION fn_get_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM perfis WHERE id = auth.uid();
$$;

-- Cria perfil automaticamente quando um novo usuário é criado no auth.users
CREATE OR REPLACE FUNCTION fn_criar_perfil_novo_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO perfis (id, nome_completo, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', 'Sem Nome'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::role_enum, 'consultor'),
    'ativo'
  );
  RETURN NEW;
END;
$$;

-- Registra mudança de status em pipeline_logs (UPDATE)
CREATE OR REPLACE FUNCTION fn_pipeline_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO pipeline_logs (lead_id, executado_por, status_anterior, status_novo)
    VALUES (NEW.id, auth.uid(), OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;

-- Registra criação de lead em pipeline_logs (INSERT)
CREATE OR REPLACE FUNCTION fn_pipeline_log_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO pipeline_logs (lead_id, executado_por, status_anterior, status_novo)
  VALUES (NEW.id, auth.uid(), NULL, NEW.status::text);
  RETURN NEW;
END;
$$;

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Atualiza ultima_movimentacao_at quando status muda
CREATE OR REPLACE FUNCTION fn_ultima_movimentacao_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.ultima_movimentacao_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Atualiza ultima_movimentacao_at quando nova interação é registrada.
-- INVOKER é seguro aqui: o consultor só insere interações nos seus leads
-- (RLS de historico_interacoes), e a policy leads_update permite que
-- atualize seus próprios leads.
CREATE OR REPLACE FUNCTION fn_ultima_movimentacao_interacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE leads
  SET ultima_movimentacao_at = now()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. TRIGGERS
-- ---------------------------------------------------------------------------

-- auth.users → cria perfil automaticamente
CREATE TRIGGER trg_criar_perfil_novo_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_criar_perfil_novo_usuario();

-- leads: log de status em INSERT
CREATE TRIGGER trg_pipeline_log_insert
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION fn_pipeline_log_insert();

-- leads: log de status em UPDATE
CREATE TRIGGER trg_pipeline_log
  AFTER UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION fn_pipeline_log();

-- leads: atualiza ultima_movimentacao_at em mudança de status
CREATE TRIGGER trg_ultima_movimentacao_status
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION fn_ultima_movimentacao_status();

-- leads: atualiza updated_at
CREATE TRIGGER trg_updated_at_leads
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- perfis: atualiza updated_at
CREATE TRIGGER trg_updated_at_perfis
  BEFORE UPDATE ON perfis
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- historico_interacoes: atualiza ultima_movimentacao_at do lead
CREATE TRIGGER trg_ultima_movimentacao_interacao
  AFTER INSERT ON historico_interacoes
  FOR EACH ROW EXECUTE FUNCTION fn_ultima_movimentacao_interacao();

-- ---------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------------

ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_interacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exportacoes_log ENABLE ROW LEVEL SECURITY;

-- perfis
CREATE POLICY perfis_select ON perfis FOR SELECT USING (
  fn_get_role() = 'admin' OR id = (SELECT auth.uid())
);
CREATE POLICY perfis_update_admin ON perfis FOR UPDATE USING (
  fn_get_role() = 'admin'
);

-- leads
CREATE POLICY leads_select ON leads FOR SELECT USING (
  fn_get_role() = 'admin' OR consultor_id = (SELECT auth.uid())
);
CREATE POLICY leads_insert ON leads FOR INSERT WITH CHECK (
  fn_get_role() = 'admin' OR consultor_id = (SELECT auth.uid())
);
CREATE POLICY leads_update ON leads FOR UPDATE USING (
  fn_get_role() = 'admin' OR consultor_id = (SELECT auth.uid())
);
CREATE POLICY leads_delete_deny ON leads FOR DELETE USING (false);

-- historico_interacoes
CREATE POLICY historico_select ON historico_interacoes FOR SELECT USING (
  fn_get_role() = 'admin' OR EXISTS (
    SELECT 1 FROM leads WHERE leads.id = historico_interacoes.lead_id AND leads.consultor_id = (SELECT auth.uid())
  )
);
CREATE POLICY historico_insert ON historico_interacoes FOR INSERT WITH CHECK (
  fn_get_role() = 'admin' OR EXISTS (
    SELECT 1 FROM leads WHERE leads.id = historico_interacoes.lead_id AND leads.consultor_id = (SELECT auth.uid())
  )
);
CREATE POLICY historico_update_deny ON historico_interacoes FOR UPDATE USING (false);
CREATE POLICY historico_delete_deny ON historico_interacoes FOR DELETE USING (false);

-- documentos_lead
CREATE POLICY documentos_select ON documentos_lead FOR SELECT USING (
  fn_get_role() = 'admin' OR EXISTS (
    SELECT 1 FROM leads WHERE leads.id = documentos_lead.lead_id AND leads.consultor_id = (SELECT auth.uid())
  )
);
CREATE POLICY documentos_insert ON documentos_lead FOR INSERT WITH CHECK (
  fn_get_role() = 'admin' OR EXISTS (
    SELECT 1 FROM leads WHERE leads.id = documentos_lead.lead_id AND leads.consultor_id = (SELECT auth.uid())
  )
);
CREATE POLICY documentos_update_deny ON documentos_lead FOR UPDATE USING (false);
CREATE POLICY documentos_delete_deny ON documentos_lead FOR DELETE USING (false);

-- pipeline_logs (somente leitura — inserção via trigger SECURITY DEFINER que bypassa RLS)
CREATE POLICY pipeline_logs_select ON pipeline_logs FOR SELECT USING (
  fn_get_role() = 'admin' OR EXISTS (
    SELECT 1 FROM leads WHERE leads.id = pipeline_logs.lead_id AND leads.consultor_id = (SELECT auth.uid())
  )
);
CREATE POLICY pipeline_logs_insert_deny ON pipeline_logs FOR INSERT WITH CHECK (false);
CREATE POLICY pipeline_logs_update_deny ON pipeline_logs FOR UPDATE USING (false);
CREATE POLICY pipeline_logs_delete_deny ON pipeline_logs FOR DELETE USING (false);

-- exportacoes_log (admin only)
CREATE POLICY exportacoes_select ON exportacoes_log FOR SELECT USING (
  fn_get_role() = 'admin'
);
CREATE POLICY exportacoes_insert ON exportacoes_log FOR INSERT WITH CHECK (
  fn_get_role() = 'admin'
);
CREATE POLICY exportacoes_update_deny ON exportacoes_log FOR UPDATE USING (false);
CREATE POLICY exportacoes_delete_deny ON exportacoes_log FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- 7. SUPABASE STORAGE — Bucket documentos-leads
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-leads',
  'documentos-leads',
  false,
  10485760,  -- 10MB
  ARRAY[
    'application/msword',                                                      -- .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  -- .docx
    'image/jpeg',                                                              -- .jpg
    'application/pdf'                                                          -- .pdf
  ]::text[]
);

-- Storage RLS: consultor acessa apenas documentos dos seus leads, admin acessa todos
CREATE POLICY storage_select ON storage.objects FOR SELECT USING (
  bucket_id = 'documentos-leads' AND (
    fn_get_role() = 'admin' OR EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id::text = (storage.foldername(name))[1]
        AND leads.consultor_id = auth.uid()
    )
  )
);
CREATE POLICY storage_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'documentos-leads' AND (
    fn_get_role() = 'admin' OR EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id::text = (storage.foldername(name))[1]
        AND leads.consultor_id = auth.uid()
    )
  )
);
CREATE POLICY storage_update_deny ON storage.objects
  FOR UPDATE USING (bucket_id = 'documentos-leads' AND false);
CREATE POLICY storage_delete_deny ON storage.objects
  FOR DELETE USING (bucket_id = 'documentos-leads' AND false);
