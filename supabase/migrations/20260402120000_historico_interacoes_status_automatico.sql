-- =============================================================================
-- Histórico de interações: registro automático em mudanças de status do lead
-- =============================================================================
-- Espelha em historico_interacoes o que já é auditado em pipeline_logs,
-- para exibição unificada na UI (data/hora, tipo, transição, quem executou).
-- Só dispara em INSERT (cadastro) ou quando OLD.status IS DISTINCT FROM NEW.status.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_status_lead_label(p status_lead_enum)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT CASE p::text
    WHEN 'atendimento' THEN 'Atendimento'
    WHEN 'negociacao' THEN 'Negociação'
    WHEN 'fechado' THEN 'Fechado'
    WHEN 'perdido' THEN 'Perdido'
    WHEN 'inativo' THEN 'Inativo'
    ELSE p::text
  END;
$$;

CREATE OR REPLACE FUNCTION fn_pipeline_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ts text;
  v_nome text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO pipeline_logs (lead_id, executado_por, status_anterior, status_novo)
    VALUES (NEW.id, auth.uid(), OLD.status::text, NEW.status::text);

    v_ts := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
    SELECT nome_completo INTO v_nome FROM perfis WHERE id = auth.uid();

    INSERT INTO historico_interacoes (lead_id, autor_id, anotacao)
    VALUES (
      NEW.id,
      auth.uid(),
      format(
        '%s | Tipo: alteração de status | Pipeline: %s → %s | Por: %s',
        v_ts,
        fn_status_lead_label(OLD.status),
        fn_status_lead_label(NEW.status),
        coalesce(v_nome, 'Usuário')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_pipeline_log_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ts text;
  v_nome text;
BEGIN
  INSERT INTO pipeline_logs (lead_id, executado_por, status_anterior, status_novo)
  VALUES (NEW.id, auth.uid(), NULL, NEW.status::text);

  v_ts := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
  SELECT nome_completo INTO v_nome FROM perfis WHERE id = auth.uid();

  INSERT INTO historico_interacoes (lead_id, autor_id, anotacao)
  VALUES (
    NEW.id,
    auth.uid(),
    format(
      '%s | Tipo: entrada no sistema | Status inicial: %s | Por: %s',
      v_ts,
      fn_status_lead_label(NEW.status),
      coalesce(v_nome, 'Usuário')
    )
  );

  RETURN NEW;
END;
$$;
