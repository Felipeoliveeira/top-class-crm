import { supabase } from '@/integrations/supabase/client'
import type { Lead, LeadOrigem, LeadStatus } from '@/types'

const BOM = '\uFEFF'

export interface LeadsListFiltersSnapshot {
  search: string
  status: LeadStatus | 'all'
  origem: LeadOrigem | 'all'
  consultorId: string | 'all'
  periodoDe: string | null
  periodoAte: string | null
}

export async function fetchDocumentCountsByLeadIds(leadIds: number[]): Promise<Record<number, number>> {
  if (leadIds.length === 0) return {}
  const { data, error } = await supabase.from('documentos_lead').select('lead_id').in('lead_id', leadIds)
  if (error) throw new Error(error.message)
  const counts: Record<number, number> = {}
  for (const row of data || []) {
    const id = row.lead_id
    counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

function escapeCsvCell(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** CSV para exportação admin: inclui RG, CPF, CNPJ conforme PRD. */
export function buildLeadsExportCsv(leads: Lead[]): string {
  const headers = [
    'id',
    'nome',
    'telefone',
    'email',
    'rg',
    'cpf',
    'cnpj',
    'razao_social',
    'status',
    'origem',
    'indicacao_responsavel_nome',
    'indicacao_responsavel_telefone',
    'necessidade',
    'servico_interesse',
    'valor_bruto',
    'valor_liquido',
    'status_financeiro',
    'consultor_id',
    'created_at',
  ]
  const lines = [headers.join(';')]
  for (const l of leads) {
    lines.push(
      [
        String(l.id),
        escapeCsvCell(l.nome),
        escapeCsvCell(l.telefone),
        escapeCsvCell(l.email ?? ''),
        escapeCsvCell(l.rg ?? ''),
        escapeCsvCell(l.cpf ?? ''),
        escapeCsvCell(l.cnpj ?? ''),
        escapeCsvCell(l.razao_social ?? ''),
        l.status,
        l.origem ?? '',
        escapeCsvCell(l.indicacao_responsavel_nome ?? ''),
        escapeCsvCell(l.indicacao_responsavel_telefone ?? ''),
        l.necessidade ?? '',
        l.servico_interesse ?? '',
        l.valor_bruto != null ? String(l.valor_bruto) : '',
        l.valor_liquido != null ? String(l.valor_liquido) : '',
        l.status_financeiro ?? '',
        l.consultor_id,
        l.created_at,
      ].join(';'),
    )
  }
  return BOM + lines.join('\r\n')
}

export async function logExportacao(params: {
  exportadoPor: string
  totalRegistros: number
  filtros: LeadsListFiltersSnapshot
}): Promise<void> {
  const { error } = await supabase.from('exportacoes_log').insert({
    exportado_por: params.exportadoPor,
    total_registros: params.totalRegistros,
    filtros_aplicados: params.filtros as unknown as Record<string, unknown>,
  })
  if (error) throw new Error(error.message)
}

export async function reassignLeadConsultor(leadId: number, novoConsultorId: string): Promise<Lead> {
  const { data, error } = await supabase.rpc('fn_reatribuir_lead_consultor', {
    p_lead_id: leadId,
    p_novo_consultor_id: novoConsultorId,
  })

  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('Resposta vazia ao reatribuir lead.')
  return row as Lead
}
