-- Cinco variantes de plano Coworking em servico_enum.
-- O valor legado 'coworking' permanece no tipo (baseline) para compatibilidade; a UI usa apenas os novos.

ALTER TYPE public.servico_enum ADD VALUE 'coworking_hora';
ALTER TYPE public.servico_enum ADD VALUE 'coworking_turno';
ALTER TYPE public.servico_enum ADD VALUE 'coworking_diaria';
ALTER TYPE public.servico_enum ADD VALUE 'coworking_mensal_4h';
ALTER TYPE public.servico_enum ADD VALUE 'coworking_mensal_8h';
