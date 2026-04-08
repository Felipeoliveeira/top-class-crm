import { supabase } from '@/integrations/supabase/client'
import type { Lead, LeadOrigem, LeadNecessidade, LeadStatus, ServicoInteresse } from '@/types'
import { MODO_IMPORTACAO_ATIVO } from '@/lib/import-mode'

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

// =============================================================================
// IMPORTAÇÃO CSV
// =============================================================================

const IMPORT_CSV_HEADERS = [
  'status',
  'nome',
  'telefone',
  'email',
  'cpf',
  'cnpj',
  'razao_social',
  'origem',
  'indicacao_responsavel_nome',
  'indicacao_responsavel_telefone',
  'necessidade',
  'servico_interesse',
  'valor_bruto',
  'vencimento_dia',
  'data_inicio_contrato',
  'data_fim_contrato',
  'possui_nota_fiscal',
  'motivo_perda',
] as const

const VALID_ORIGENS: LeadOrigem[] = ['indicacao', 'google', 'placa', 'rede_social', 'outros']
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
  status: 'atendimento' | 'negociacao' | 'fechado' | 'perdido'
  nome: string
  telefone: string
  email: string | null
  cpf: string | null
  cnpj: string | null
  razao_social: string | null
  origem: LeadOrigem
  /** Preenchido apenas quando origem = 'indicacao' */
  indicacao_responsavel_nome: string | null
  /** Preenchido apenas quando origem = 'indicacao', formato (XX) XXXXX-XXXX */
  indicacao_responsavel_telefone: string | null
  necessidade: LeadNecessidade
  servico_interesse: ServicoInteresse | null
  valor_bruto: number | null
  data_prevista_pagamento: number | null
  data_inicio_contrato: string | null
  data_fim_contrato: string | null
  possui_nota_fiscal: boolean | null
  /** Obrigatório quando status = 'perdido' */
  motivo_perda: string | null
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
  // Exemplo 1: cliente em negociacao (dados completos)
  const exNegociacao = [
    'negociacao',          // status: atendimento | negociacao | fechado | perdido
    'João da Silva',       // nome
    '(79) 99999-9999',    // telefone
    'joao@email.com',     // email
    '123.456.789-09',     // cpf (obrigatório em negociacao; opcional em fechado)
    '',                    // cnpj
    '',                    // razao_social
    'indicacao',           // origem
    'Maria Souza',         // indicacao_responsavel_nome (só quando origem=indicacao)
    '(79) 98888-7777',    // indicacao_responsavel_telefone (só quando origem=indicacao)
    'escritorio_virtual',  // necessidade
    'plano_pro',           // servico_interesse
    '850',                 // valor_bruto
    '10',                  // vencimento_dia
    '2026-05-01',          // data_inicio_contrato
    '2027-04-30',          // data_fim_contrato
    'sim',                 // possui_nota_fiscal: sim | nao (opcional em fechado)
    '',                    // motivo_perda (obrigatório só quando status=perdido)
  ]
  // Exemplo 2: cliente já fechado com dados parciais
  const exFechado = [
    'fechado',
    'Ana Costa',
    '(79) 98765-4321',
    'ana@email.com',
    '',                    // cpf: pode estar vazio quando status=fechado
    '',
    '',
    'google',
    '',
    '',
    'escritorio_virtual',
    'plano_premium',
    '1200',
    '5',
    '2025-01-01',
    '2025-12-31',
    '',                    // possui_nota_fiscal: pode estar vazio quando status=fechado
    '',
  ]
  // Exemplo 3: cliente perdido
  const exPerdido = [
    'perdido',
    'Carlos Lima',
    '(79) 91234-5678',
    'carlos@email.com',
    '',
    '',
    '',
    'rede_social',
    '',
    '',
    'salas',
    '',
    '',
    '',
    '',
    '',
    '',
    'preco_alto',          // motivo_perda: obrigatório quando status=perdido
  ]
  return BOM + [
    IMPORT_CSV_HEADERS.join(';'),
    exNegociacao.join(';'),
    exFechado.join(';'),
    exPerdido.join(';'),
  ].join('\r\n')
}

const VALID_IMPORT_STATUSES = ['atendimento', 'negociacao', 'fechado', 'perdido'] as const
type ImportStatus = typeof VALID_IMPORT_STATUSES[number]

/** Faz o parse e validação de um arquivo CSV de importação de leads.
 *
 * Regras de obrigatoriedade por status:
 *  - Todos:        nome, telefone, origem, necessidade
 *  - negociacao:   + email, servico_interesse, valor_bruto, vencimento, datas, cpf, possui_nota_fiscal
 *  - fechado:      + email, servico_interesse, valor_bruto, vencimento, datas
 *                  (cpf e possui_nota_fiscal são opcionais — badge visual exibida no Kanban quando ausentes)
 *  - perdido:      + motivo_perda
 *  - atendimento:  somente os campos base
 */
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

    // Leitura de campos
    const status_raw = (row['status'] ?? '').toLowerCase().trim()
    const nome = row['nome'] ?? ''
    const telefone = row['telefone'] ?? ''
    const email = row['email'] ?? ''
    const cpf = row['cpf'] ?? ''
    const cnpj = row['cnpj'] ?? ''
    const razao_social = row['razao_social'] ?? ''
    const origem = row['origem'] ?? ''
    const indicacao_responsavel_nome = row['indicacao_responsavel_nome'] ?? ''
    const indicacao_responsavel_telefone = row['indicacao_responsavel_telefone'] ?? ''
    const necessidade = row['necessidade'] ?? ''
    const servico_interesse = row['servico_interesse'] ?? ''
    const valor_bruto_str = row['valor_bruto'] ?? ''
    const vencimento_str = row['vencimento_dia'] ?? ''
    const data_inicio = row['data_inicio_contrato'] ?? ''
    const data_fim = row['data_fim_contrato'] ?? ''
    const nota_fiscal_str = (row['possui_nota_fiscal'] ?? '').toLowerCase().trim()
    const motivo_perda = row['motivo_perda'] ?? ''

    // --- Validação de status ---
    if (!status_raw) {
      errors.push(`Status é obrigatório. Use: ${VALID_IMPORT_STATUSES.join(', ')}`)
    } else if (!VALID_IMPORT_STATUSES.includes(status_raw as ImportStatus)) {
      errors.push(`Status inválido: "${status_raw}". Use: ${VALID_IMPORT_STATUSES.join(', ')}`)
    }
    const status = status_raw as ImportStatus

    // --- Campos obrigatórios para todos os status ---
    if (!nome) errors.push('Nome é obrigatório')
    if (!telefone) errors.push('Telefone é obrigatório')
    else if (!isValidTelefone(telefone)) errors.push('Telefone inválido (formato: (DD) 9XXXX-XXXX)')
    if (!origem) errors.push('Origem é obrigatória')
    else if (!VALID_ORIGENS.includes(origem as LeadOrigem)) {
      errors.push(`Origem inválida: "${origem}". Use: ${VALID_ORIGENS.join(', ')}`)
    }
    if (!necessidade) errors.push('Necessidade é obrigatória')
    else if (!VALID_NECESSIDADES.includes(necessidade as LeadNecessidade)) {
      errors.push(`Necessidade inválida: "${necessidade}". Use: ${VALID_NECESSIDADES.join(', ')}`)
    }
    if (indicacao_responsavel_telefone && !isValidTelefone(indicacao_responsavel_telefone)) {
      errors.push('Número do responsável da indicação inválido (formato: (DD) 9XXXX-XXXX)')
    }

    // --- Validação de CPF/CNPJ (formato, quando preenchidos) ---
    if (cpf && !isValidCpfDigits(cpf)) errors.push('CPF inválido')
    if (cnpj && !isValidCnpjDigits(cnpj)) errors.push('CNPJ inválido')
    if (cnpj && !razao_social) errors.push('Razão Social é obrigatória quando CNPJ está preenchido')

    // --- Campos obrigatórios para negociacao e fechado ---
    const requiresContractFields = status === 'negociacao' || status === 'fechado'
    if (requiresContractFields) {
      if (!email) errors.push('E-mail é obrigatório')
      else if (!isValidEmail(email)) errors.push('E-mail inválido')

      if (!servico_interesse) errors.push('Serviço de interesse é obrigatório')
      else if (!VALID_SERVICOS.includes(servico_interesse as ServicoInteresse)) {
        errors.push(`Serviço inválido: "${servico_interesse}". Use: ${VALID_SERVICOS.join(', ')}`)
      }

      const valor_bruto_parsed = parseFloat(valor_bruto_str.replace(',', '.'))
      if (!valor_bruto_str) errors.push('Valor bruto é obrigatório')
      else if (isNaN(valor_bruto_parsed) || valor_bruto_parsed <= 0) {
        errors.push('Valor bruto inválido (deve ser número positivo)')
      }

      const vencimento_parsed = parseInt(vencimento_str, 10)
      if (!vencimento_str) errors.push('Vencimento (dia) é obrigatório')
      else if (isNaN(vencimento_parsed) || vencimento_parsed < 1 || vencimento_parsed > 31) {
        errors.push('Vencimento deve ser entre 1 e 31')
      }

      if (!data_inicio) errors.push('Data de início do contrato é obrigatória')
      else if (!isValidIsoDate(data_inicio)) errors.push('Data de início inválida (use YYYY-MM-DD)')
      if (!data_fim) errors.push('Data de fim do contrato é obrigatória')
      else if (!isValidIsoDate(data_fim)) errors.push('Data de fim inválida (use YYYY-MM-DD)')
      if (data_inicio && data_fim && isValidIsoDate(data_inicio) && isValidIsoDate(data_fim) && data_fim < data_inicio) {
        errors.push('Data de fim deve ser igual ou posterior à data de início')
      }
    }

    // --- CPF e nota fiscal: obrigatórios apenas em negociacao ---
    if (status === 'negociacao') {
      if (!cpf) errors.push('CPF é obrigatório')
      if (!nota_fiscal_str) errors.push('Possui nota fiscal é obrigatório (sim ou nao)')
      else if (nota_fiscal_str !== 'sim' && nota_fiscal_str !== 'nao') {
        errors.push('Possui nota fiscal deve ser "sim" ou "nao"')
      }
    } else if (nota_fiscal_str && nota_fiscal_str !== 'sim' && nota_fiscal_str !== 'nao') {
      errors.push('Possui nota fiscal deve ser "sim" ou "nao"')
    }

    // --- motivo_perda: obrigatório apenas em perdido ---
    if (status === 'perdido' && !motivo_perda) {
      errors.push('Motivo da perda é obrigatório quando status é "perdido"')
    }

    if (errors.length > 0) {
      results.push({ rowIndex, success: false, errors })
      continue
    }

    // Parsear valores numéricos (já validados acima)
    const requiresContractFieldsClean = status === 'negociacao' || status === 'fechado'
    const valor_bruto = requiresContractFieldsClean
      ? parseFloat(valor_bruto_str.replace(',', '.'))
      : null
    const vencimento = requiresContractFieldsClean
      ? parseInt(vencimento_str, 10)
      : null

    results.push({
      rowIndex,
      success: true,
      errors: [],
      data: {
        status,
        nome,
        telefone,
        email: email || null,
        cpf: cpf || null,
        cnpj: cnpj || null,
        razao_social: razao_social || null,
        origem: origem as LeadOrigem,
        indicacao_responsavel_nome: indicacao_responsavel_nome || null,
        indicacao_responsavel_telefone: indicacao_responsavel_telefone || null,
        necessidade: necessidade as LeadNecessidade,
        servico_interesse: servico_interesse ? servico_interesse as ServicoInteresse : null,
        valor_bruto,
        data_prevista_pagamento: vencimento,
        data_inicio_contrato: data_inicio || null,
        data_fim_contrato: data_fim || null,
        possui_nota_fiscal: nota_fiscal_str === 'sim' ? true : nota_fiscal_str === 'nao' ? false : null,
        motivo_perda: motivo_perda || null,
      },
    })
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
    const { motivo_perda, status, ...rest } = row.data!
    // Leads fechados importados têm sua data de cadastro definida como a data de início
    // do contrato, pois o fechamento já ocorreu antes da importação no sistema.
    const createdAtOverride =
      status === 'fechado' && rest.data_inicio_contrato
        ? { created_at: `${rest.data_inicio_contrato}T12:00:00.000Z` }
        : {}

    const payload = {
      ...rest,
      ...createdAtOverride,
      consultor_id: consultorId,
      status: status as LeadStatus,
      status_financeiro: 'pago' as const,
      importado_csv: true,
      // perdido: registra o motivo da perda no campo correto da tabela
      ...(status === 'perdido' && motivo_perda
        ? { motivo_perda_tipo: 'outro' as const, motivo_perda_descricao: motivo_perda }
        : {}),
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
