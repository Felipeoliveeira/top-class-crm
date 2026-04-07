-- Campos para rastrear o responsável pela indicação de um lead
ALTER TABLE leads
  ADD COLUMN indicacao_responsavel_nome      TEXT,
  ADD COLUMN indicacao_responsavel_telefone  TEXT;

COMMENT ON COLUMN leads.indicacao_responsavel_nome     IS 'Nome do responsável pela indicação (preenchido apenas quando origem = indicacao)';
COMMENT ON COLUMN leads.indicacao_responsavel_telefone IS 'Telefone do responsável pela indicação no formato (XX) XXXXX-XXXX';
