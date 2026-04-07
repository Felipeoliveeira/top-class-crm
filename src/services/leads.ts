import { supabase } from '@/integrations/supabase/client'
import type { Lead, LeadOrigem, LeadNecessidade, LeadStatus, ServicoInteresse } from '@/types'

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

// =============================================================================
// IMPORTAÇÃO CSV
// =============================================================================

const IMPORT_CSV_HEADERS = [
  'nome',
  'telefone',
  'email',
  'cpf',
  'cnpj',
  'razao_social',
  'origem',
  'necessidade',
  'servico_interesse',
  'valor_bruto',
  'vencimento_dia',
  'data_inicio_contrato',
  'data_fim_contrato',
  'possui_nota_fiscal',
] as const

const VALID_ORIGENS: LeadOrigem[] = ['indicacao', 'google', 'placa', 'rede_social']
const VALID_NECESSIDADES: LeadNecessidade[] = ['escritorio_virtual', 'salas', 'endereco_fiscal', 'coworking']
const VALID_SERVICOS: ServicoInteresse[] = [
  'plano_pro', 'plano_premium', 'plano_top', 'coworking',
  'sala_special_room', 'mini_sala_reuniao', 'sala_reuniao_8', 'sala_reuniao_12', 'salas_fixas',
]

const MAX_IMPORT_ROWS = 200

export interface ImportRowResult {
  rowIndex: number
  success: boolean
  errors: string[]
  data?: ImportLeadPayload
}

export interface ImportLeadPayload {
  nome: string
  telefone: string
  email: string
  cpf: string
  cnpj: string | null
  razao_social: string | null
  origem: LeadOrigem
  necessidade: LeadNecessidade
  servico_interesse: ServicoInteresse
  valor_bruto: number
  data_prevista_pagamento: number
  data_inicio_contrato: string
  data_fim_contrato: string
  possui_nota_fiscal: boolean
}

function isValidTelefone(tel: string): boolean {
  const digits = tel.replace(/\D/g, '')
  return /^[1-9]{2}9\d{8}$/.test(digits)
}

function isValidCpfDigits(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false
  const calc = (mod: number) => {
    let sum = 0
    for (let i = 0; i < mod - 1; i++) sum += parseInt(digits[i]) * (mod - i)
    const rest = (sum * 10) % 11
    return rest === 10 || rest === 11 ? 0 : rest
  }
  return calc(10) === parseInt(digits[9]) && calc(11) === parseInt(digits[10])
}

function isValidCnpjDigits(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false
  const calc = (len: number) => {
    let sum = 0
    let pos = len - 7
    for (let i = len; i >= 1; i--) {
      sum += parseInt(digits[len - i]) * pos--
      if (pos < 2) pos = 9
    }
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  return calc(12) === parseInt(digits[12]) && calc(13) === parseInt(digits[13])
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidIsoDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date))
}

/** Gera o CSV template para download, com cabeçalhos e 1 linha de exemplo. */
export function buildCsvTemplate(): string {
  const example = [
    'João da Silva',
    '(79) 99999-9999',
    'joao@email.com',
    '123.456.789-09',
    '',
    '',
    'indicacao',
    'escritorio_virtual',
    'plano_pro',
    '850',
    '10',
    '2026-05-01',
    '2027-04-30',
    'sim',
  ]
  return BOM + [IMPORT_CSV_HEADERS.join(';'), example.join(';')].join('\r\n')
}

/** Faz o parse e validação de um arquivo CSV de importação de leads. */
export function parseImportCsv(csvText: string): ImportRowResult[] {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const header = lines[0].split(';').map(h => h.trim().replace(/^\uFEFF/, ''))
  const dataLines = lines.slice(1)

  const results: ImportRowResult[] = []

  if (dataLines.length > MAX_IMPORT_ROWS) {
    return [{
      rowIndex: 0,
      success: false,
      errors: [`O arquivo contém ${dataLines.length} linhas. O máximo permitido é ${MAX_IMPORT_ROWS}.`],
    }]
  }

  for (let i = 0; i < dataLines.length; i++) {
    const rowIndex = i + 2
    const cells = dataLines[i].split(';').map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
    const row: Record<string, string> = {}
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = cells[j] ?? ''
    }

    const errors: string[] = []

    const nome = row['nome'] ?? ''
    const telefone = row['telefone'] ?? ''
    const email = row['email'] ?? ''
    const cpf = row['cpf'] ?? ''
    const cnpj = row['cnpj'] ?? ''
    const razao_social = row['razao_social'] ?? ''
    const origem = row['origem'] ?? ''
    const necessidade = row['necessidade'] ?? ''
    const servico_interesse = row['servico_interesse'] ?? ''
    const valor_bruto_str = row['valor_bruto'] ?? ''
    const vencimento_str = row['vencimento_dia'] ?? ''
    const data_inicio = row['data_inicio_contrato'] ?? ''
    const data_fim = row['data_fim_contrato'] ?? ''
    const nota_fiscal_str = row['possui_nota_fiscal'] ?? ''

    if (!nome) errors.push('Nome é obrigatório')
    if (!telefone) errors.push('Telefone é obrigatório')
    else if (!isValidTelefone(telefone)) errors.push('Telefone inválido (formato: (DD) 9XXXX-XXXX)')
    if (!email) errors.push('E-mail é obrigatório')
    else if (!isValidEmail(email)) errors.push('E-mail inválido')
    if (!cpf) errors.push('CPF é obrigatório')
    else if (!isValidCpfDigits(cpf)) errors.push('CPF inválido')
    if (cnpj && !isValidCnpjDigits(cnpj)) errors.push('CNPJ inválido')
    if (cnpj && !razao_social) errors.push('Razão Social é obrigatória quando CNPJ está preenchido')
    if (!origem) errors.push('Origem é obrigatória')
    else if (!VALID_ORIGENS.includes(origem as LeadOrigem)) errors.push(`Origem inválida: "${origem}". Use: ${VALID_ORIGENS.join(', ')}`)
    if (!necessidade) errors.push('Necessidade é obrigatória')
    else if (!VALID_NECESSIDADES.includes(necessidade as LeadNecessidade)) errors.push(`Necessidade inválida: "${necessidade}". Use: ${VALID_NECESSIDADES.join(', ')}`)
    if (!servico_interesse) errors.push('Serviço de interesse é obrigatório')
    else if (!VALID_SERVICOS.includes(servico_interesse as ServicoInteresse)) errors.push(`Serviço inválido: "${servico_interesse}". Use: ${VALID_SERVICOS.join(', ')}`)

    const valor_bruto = parseFloat(valor_bruto_str.replace(',', '.'))
    if (!valor_bruto_str) errors.push('Valor bruto é obrigatório')
    else if (isNaN(valor_bruto) || valor_bruto <= 0) errors.push('Valor bruto inválido (deve ser número positivo)')

    const vencimento = parseInt(vencimento_str, 10)
    if (!vencimento_str) errors.push('Vencimento (dia) é obrigatório')
    else if (isNaN(vencimento) || vencimento < 1 || vencimento > 31) errors.push('Vencimento deve ser entre 1 e 31')

    if (!data_inicio) errors.push('Data de início do contrato é obrigatória')
    else if (!isValidIsoDate(data_inicio)) errors.push('Data de início inválida (use YYYY-MM-DD)')
    if (!data_fim) errors.push('Data de fim do contrato é obrigatória')
    else if (!isValidIsoDate(data_fim)) errors.push('Data de fim inválida (use YYYY-MM-DD)')
    if (data_inicio && data_fim && isValidIsoDate(data_inicio) && isValidIsoDate(data_fim) && data_fim < data_inicio) {
      errors.push('Data de fim deve ser igual ou posterior à data de início')
    }

    const nota_fiscal_norm = nota_fiscal_str.toLowerCase().trim()
    if (!nota_fiscal_str) errors.push('Possui nota fiscal é obrigatório (sim ou nao)')
    else if (nota_fiscal_norm !== 'sim' && nota_fiscal_norm !== 'nao') errors.push('Possui nota fiscal deve ser "sim" ou "nao"')

    if (errors.length > 0) {
      results.push({ rowIndex, success: false, errors })
    } else {
      results.push({
        rowIndex,
        success: true,
        errors: [],
        data: {
          nome,
          telefone,
          email,
          cpf,
          cnpj: cnpj || null,
          razao_social: razao_social || null,
          origem: origem as LeadOrigem,
          necessidade: necessidade as LeadNecessidade,
          servico_interesse: servico_interesse as ServicoInteresse,
          valor_bruto,
          data_prevista_pagamento: vencimento,
          data_inicio_contrato: data_inicio,
          data_fim_contrato: data_fim,
          possui_nota_fiscal: nota_fiscal_norm === 'sim',
        },
      })
    }
  }

  return results
}

export interface ImportLeadsResult {
  totalSucesso: number
  totalErros: number
  erros: { rowIndex: number; message: string }[]
}

/** Insere os leads válidos no Supabase e registra auditoria. */
export async function importLeads(
  rows: ImportRowResult[],
  consultorId: string,
  importadoPor: string,
): Promise<ImportLeadsResult> {
  const validRows = rows.filter(r => r.success && r.data)
  const result: ImportLeadsResult = { totalSucesso: 0, totalErros: 0, erros: [] }

  for (const row of validRows) {
    const payload = {
      ...row.data!,
      consultor_id: consultorId,
      status: 'negociacao' as LeadStatus,
      status_financeiro: 'pago' as const,
    }

    const { error } = await supabase.from('leads').insert(payload)
    if (error) {
      result.totalErros++
      result.erros.push({ rowIndex: row.rowIndex, message: error.message })
    } else {
      result.totalSucesso++
    }
  }

  await supabase.from('importacoes_log').insert({
    importado_por: importadoPor,
    total_registros: rows.length,
    total_sucesso: result.totalSucesso,
    total_erros: result.totalErros,
  })

  return result
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
