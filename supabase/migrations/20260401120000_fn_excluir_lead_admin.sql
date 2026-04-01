-- Exclusão de lead por admin: remove dependências e o registro principal.
-- RLS não permite DELETE direto em leads; esta função valida role e executa com privilégios elevados.

CREATE OR REPLACE FUNCTION fn_excluir_lead_admin(p_lead_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF fn_get_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir leads';
  END IF;

  DELETE FROM historico_interacoes WHERE lead_id = p_lead_id;
  DELETE FROM documentos_lead WHERE lead_id = p_lead_id;
  DELETE FROM pipeline_logs WHERE lead_id = p_lead_id;
  DELETE FROM leads WHERE id = p_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_excluir_lead_admin(bigint) TO authenticated;

-- Permite ao admin remover arquivos do bucket após exclusão do lead (OR com policy deny existente)
CREATE POLICY storage_delete_admin ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documentos-leads'
    AND fn_get_role() = 'admin'
  );
