-- Datas de contrato (obrigatórias ao fechar: Negociação → Fechado)

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS data_inicio_contrato date,
  ADD COLUMN IF NOT EXISTS data_fim_contrato date;

CREATE OR REPLACE FUNCTION fn_validate_lead_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'atendimento' AND NEW.status IN ('negociacao', 'perdido')) OR
    (OLD.status = 'negociacao'  AND NEW.status IN ('fechado', 'perdido')) OR
    (OLD.status = 'fechado'     AND NEW.status = 'inativo')
  ) THEN
    RAISE EXCEPTION 'Transição de "%" para "%" não é permitida.', OLD.status, NEW.status;
  END IF;

  IF OLD.status = 'atendimento' AND NEW.status = 'negociacao' THEN
    IF NEW.origem IS NULL THEN
      RAISE EXCEPTION 'Campo "Origem" é obrigatório para avançar para Negociação.';
    END IF;
    IF NEW.necessidade IS NULL THEN
      RAISE EXCEPTION 'Campo "Necessidade" é obrigatório para avançar para Negociação.';
    END IF;
  END IF;

  IF OLD.status = 'negociacao' AND NEW.status = 'fechado' THEN
    IF NEW.servico_interesse IS NULL THEN
      RAISE EXCEPTION 'Campo "Serviço de Interesse" é obrigatório para Fechar.';
    END IF;
    IF NEW.valor_bruto IS NULL THEN
      RAISE EXCEPTION 'Campo "Valor Bruto" é obrigatório para Fechar.';
    END IF;
    IF NEW.email IS NULL OR NEW.email = '' THEN
      RAISE EXCEPTION 'Campo "E-mail" é obrigatório para Fechar.';
    END IF;
    IF NEW.rg IS NULL OR NEW.rg = '' THEN
      RAISE EXCEPTION 'Campo "RG" é obrigatório para Fechar.';
    END IF;
    IF NEW.cpf IS NULL OR NEW.cpf = '' THEN
      RAISE EXCEPTION 'Campo "CPF" é obrigatório para Fechar.';
    END IF;
    IF NEW.cnpj IS NOT NULL AND NEW.cnpj != '' AND (NEW.razao_social IS NULL OR NEW.razao_social = '') THEN
      RAISE EXCEPTION 'Campo "Razão Social" é obrigatório quando CNPJ é informado.';
    END IF;
    IF NEW.status_financeiro IS DISTINCT FROM 'pago' THEN
      RAISE EXCEPTION 'Status Financeiro deve ser "Pago" para Fechar.';
    END IF;
    IF NEW.data_prevista_pagamento IS NULL OR NEW.data_prevista_pagamento < 1 OR NEW.data_prevista_pagamento > 31 THEN
      RAISE EXCEPTION 'Campo "Vencimento" (dia 1 a 31) é obrigatório para Fechar.';
    END IF;
    IF NEW.data_inicio_contrato IS NULL THEN
      RAISE EXCEPTION 'Campo "Data início do contrato" é obrigatório para Fechar.';
    END IF;
    IF NEW.data_fim_contrato IS NULL THEN
      RAISE EXCEPTION 'Campo "Data fim do contrato" é obrigatório para Fechar.';
    END IF;
    IF NEW.data_fim_contrato < NEW.data_inicio_contrato THEN
      RAISE EXCEPTION 'A data fim do contrato não pode ser anterior à data de início.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM documentos_lead WHERE lead_id = NEW.id) THEN
      RAISE EXCEPTION 'Ao menos 1 documento é obrigatório para Fechar.';
    END IF;
  END IF;

  IF NEW.status = 'perdido' THEN
    IF NEW.motivo_perda_tipo IS NULL THEN
      RAISE EXCEPTION 'Motivo da perda é obrigatório.';
    END IF;
    IF NEW.motivo_perda_tipo = 'outro' AND (NEW.motivo_perda_descricao IS NULL OR NEW.motivo_perda_descricao = '') THEN
      RAISE EXCEPTION 'Descrição do motivo é obrigatória quando tipo é "Outro".';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
