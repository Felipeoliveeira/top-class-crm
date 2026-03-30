-- Permite que o próprio usuário autenticado atualize apenas ultimo_acesso (login),
-- sem abrir UPDATE genérico em perfis para consultores (RF-31 / PRD).

CREATE OR REPLACE FUNCTION public.fn_atualizar_ultimo_acesso()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE perfis
  SET ultimo_acesso = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.fn_atualizar_ultimo_acesso() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_atualizar_ultimo_acesso() TO authenticated;

COMMENT ON FUNCTION public.fn_atualizar_ultimo_acesso IS 'Chamada após login bem-sucedido para registrar último acesso (RF-31).';
