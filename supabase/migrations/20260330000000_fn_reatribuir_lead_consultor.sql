-- Reatribuição de consultor (admin): atualiza leads e registra em pipeline_logs.
-- INSERT em pipeline_logs só é permitido via função SECURITY DEFINER (RLS bloqueia cliente).

CREATE OR REPLACE FUNCTION fn_reatribuir_lead_consultor(
  p_lead_id bigint,
  p_novo_consultor_id uuid
)
RETURNS SETOF leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old uuid;
  v_status text;
BEGIN
  IF fn_get_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem reatribuir leads.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM perfis
    WHERE id = p_novo_consultor_id
      AND status = 'ativo'
      AND role IN ('consultor', 'admin')
  ) THEN
    RAISE EXCEPTION 'Consultor de destino inválido ou inativo.';
  END IF;

  SELECT consultor_id, status::text INTO v_old, v_status
  FROM leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado.';
  END IF;

  IF v_old = p_novo_consultor_id THEN
    RETURN QUERY SELECT * FROM leads WHERE id = p_lead_id;
    RETURN;
  END IF;

  UPDATE leads
  SET consultor_id = p_novo_consultor_id
  WHERE id = p_lead_id;

  INSERT INTO pipeline_logs (lead_id, executado_por, status_anterior, status_novo, observacao)
  VALUES (
    p_lead_id,
    auth.uid(),
    'reatribuicao',
    v_status,
    format('Reatribuição de consultor: %s → %s', v_old, p_novo_consultor_id)
  );

  RETURN QUERY SELECT * FROM leads WHERE id = p_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_reatribuir_lead_consultor(bigint, uuid) TO authenticated;
