-- =============================================================================
-- MIGRATION: Configuração do bucket documentos-leads
-- =============================================================================
-- Aplica limite de 10MB por arquivo, restrição de MIME types e policies de
-- bloqueio para UPDATE/DELETE conforme PRD Seção 6.6 e RF-19.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Configurar limite de tamanho e formatos aceitos
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET
  file_size_limit = 10485760,  -- 10MB em bytes
  allowed_mime_types = ARRAY[
    'application/msword',                                                          -- .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',      -- .docx
    'image/jpeg',                                                                  -- .jpg
    'application/pdf'                                                              -- .pdf
  ]::text[]
WHERE id = 'documentos-leads';

-- ---------------------------------------------------------------------------
-- 2. Policies de bloqueio: documentos não podem ser alterados nem excluídos
-- ---------------------------------------------------------------------------
CREATE POLICY storage_update_deny ON storage.objects
  FOR UPDATE USING (bucket_id = 'documentos-leads' AND false);

CREATE POLICY storage_delete_deny ON storage.objects
  FOR DELETE USING (bucket_id = 'documentos-leads' AND false);
