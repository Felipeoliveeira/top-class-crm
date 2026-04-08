-- Marca leads que foram inseridos via importação CSV.
-- Usado para exibir badge visual no Kanban quando o lead em "fechado" tem dados incompletos.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS importado_csv boolean NOT NULL DEFAULT false;
