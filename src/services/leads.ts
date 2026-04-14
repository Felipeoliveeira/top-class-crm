import { supabase } from '@/integrations/supabase/client'
import type { Lead, LeadOrigem, LeadNecessidade, LeadStatus, ServicoInteresse } from '@/types'
import { calculateValorLiquido } from '@/services/pipeline'
import { isValidCpf, isValidCnpj } from '@/lib/br-inputs'
import * as XLSX from 'xlsx'
import {
  normalizeNome,
  normalizeTelefone,
  normalizeCpf,
  normalizeCnpj,
  normalizeEmail,
  normalizeValor,
  normalizeVencimento,
  normalizeDate,
  normalizeNotaFiscal,
  normalizeStatus,
  normalizeEnumField,
  normalizeServicoInteresse,
  isEmailValid,
  isValidTelefoneImport,
} from '@/lib/csv-normalizers'

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
  'contato_numero',
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
  'plano_pro',
  'plano_premium',
  'plano_top',
  'coworking_hora',
  'coworking_turno',
  'coworking_diaria',
  'coworking_mensal_4h',
  'coworking_mensal_8h',
  'sala_special_room',
  'mini_sala_reuniao',
  'sala_reuniao_8',
  'sala_reuniao_12',
  'salas_fixas',
]

const MAX_IMPORT_ROWS = 200

/**
 * Faz parse de uma linha CSV no formato delimitado por `;`, respeitando aspas.
 * Permite delimitador dentro da célula quando o conteúdo está entre aspas.
 */
function parseSemicolonCsvRow(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ';' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

export interface ImportRowError {
  field: string
  message: string
}

export interface ImportRowResult {
  rowIndex: number
  success: boolean
  errors: ImportRowError[]
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
  /** Segundo e-mail / contato adicional (ex.: importação Top Class) */
  contato_numero: string | null
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


/** Gera o CSV template para download, com cabeçalhos e 1 linha de exemplo. */
export function buildCsvTemplate(): string {
  // Exemplo 1: cliente em negociacao (dados completos)
  const exNegociacao = [
    'negociacao',          // status: atendimento | negociacao | fechado | perdido
    'João da Silva',       // nome
    '(79) 99999-9999',    // telefone
    'joao@email.com',     // email
    '',                    // contato_numero (opcional)
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
    '',                    // contato_numero
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
    '',                    // contato_numero
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

/** Gera template Excel (.xlsx) com aba de dados e aba de instruções. */
export function buildExcelTemplate(): Blob {
  const wb = XLSX.utils.book_new()

  // ── Aba "Template" com cabeçalhos e exemplos ──
  const templateData = [
    [...IMPORT_CSV_HEADERS],
    [
      'negociacao', 'João da Silva', '(79) 99999-9999', 'joao@email.com', '',
      '123.456.789-09', '', '', 'indicacao', 'Maria Souza', '(79) 98888-7777',
      'escritorio_virtual', 'plano_pro', '850', '10', '2026-05-01', '2027-04-30', 'sim', '',
    ],
    [
      'fechado', 'Ana Costa', '(79) 98765-4321', 'ana@email.com', '',
      '', '', '', 'google', '', '',
      'escritorio_virtual', 'plano_premium', '1200', '5', '2025-01-01', '2025-12-31', '', '',
    ],
    [
      'perdido', 'Carlos Lima', '(79) 91234-5678', 'carlos@email.com', '',
      '', '', '', 'rede_social', '', '',
      'salas', '', '', '', '', '', '', 'preco_alto',
    ],
  ]
  const wsTemplate = XLSX.utils.aoa_to_sheet(templateData)
  const colWidths = IMPORT_CSV_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 18) }))
  wsTemplate['!cols'] = colWidths
  XLSX.utils.book_append_sheet(wb, wsTemplate, 'Template')

  // ── Aba "Instruções" com descrição de cada campo ──
  const instrucoes = [
    ['Campo', 'Descrição', 'Obrigatório em', 'Valores aceitos / Formato'],
    ['status', 'Estágio do lead no pipeline', 'Todos', 'atendimento, negociacao, fechado, perdido'],
    ['nome', 'Nome completo do lead', 'Todos', 'Texto livre'],
    ['telefone', 'Telefone fixo ou celular', 'Opcional (recomendado)', '(DD) 9XXXX-XXXX ou apenas dígitos (10-11); vazio importa com aviso no Kanban'],
    ['email', 'E-mail do lead', 'negociacao, fechado', 'exemplo@dominio.com'],
    ['contato_numero', 'Contato adicional (ex.: 2º e-mail)', 'Opcional', 'Texto livre'],
    ['cpf', 'CPF (11 dígitos)', 'negociacao', '123.456.789-09 ou apenas dígitos'],
    ['cnpj', 'CNPJ (14 dígitos)', 'Opcional (requer razao_social)', '12.345.678/0001-00 ou apenas dígitos'],
    ['razao_social', 'Razão social (PJ)', 'Quando CNPJ preenchido', 'Texto livre'],
    ['origem', 'Canal de origem do lead', 'Todos', 'indicacao, google, placa, rede_social, outros'],
    ['indicacao_responsavel_nome', 'Nome de quem indicou', 'Opcional (origem=indicacao)', 'Texto livre'],
    ['indicacao_responsavel_telefone', 'Telefone de quem indicou', 'Opcional (origem=indicacao)', '(DD) 9XXXX-XXXX'],
    ['necessidade', 'Necessidade do lead', 'Todos', 'escritorio_virtual, salas, endereco_fiscal, coworking'],
    ['servico_interesse', 'Serviço contratado / de interesse', 'negociacao, fechado', 'plano_pro, plano_premium, plano_top, coworking_hora, coworking_turno, coworking_diaria, coworking_mensal_4h, coworking_mensal_8h, sala_special_room, mini_sala_reuniao, sala_reuniao_8, sala_reuniao_12, salas_fixas'],
    ['valor_bruto', 'Valor mensal (R$)', 'negociacao, fechado', 'Número: 850 ou 1.200,50 ou R$ 850'],
    ['vencimento_dia', 'Dia de vencimento (0–31)', 'negociacao, fechado', 'Número: 0 a 31 (0 = pagamento integral)'],
    ['data_inicio_contrato', 'Início do contrato', 'negociacao, fechado', 'DD/MM/YYYY, DD-MM-YYYY ou YYYY-MM-DD'],
    ['data_fim_contrato', 'Fim do contrato', 'negociacao, fechado', 'DD/MM/YYYY, DD-MM-YYYY ou YYYY-MM-DD'],
    ['possui_nota_fiscal', 'Emite nota fiscal?', 'negociacao', 'sim/s/1/true/yes ou nao/n/0/false/no'],
    ['motivo_perda', 'Motivo da perda', 'perdido', 'Texto livre'],
  ]
  const wsInstrucoes = XLSX.utils.aoa_to_sheet(instrucoes)
  wsInstrucoes['!cols'] = [{ wch: 32 }, { wch: 36 }, { wch: 28 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsInstrucoes, 'Instruções')

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** Converte a primeira sheet de um arquivo .xlsx em texto CSV (separador ;). */
export function xlsxToCsvText(arrayBuffer: ArrayBuffer): string {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const firstSheetName = wb.SheetNames[0]
  if (!firstSheetName) return ''
  const ws = wb.Sheets[firstSheetName]
  return XLSX.utils.sheet_to_csv(ws, { FS: ';' })
}

const VALID_IMPORT_STATUSES = ['atendimento', 'negociacao', 'fechado', 'perdido'] as const
type ImportStatus = typeof VALID_IMPORT_STATUSES[number]

/** Faz o parse e validação de um arquivo CSV de importação de leads.
 *
 * Regras de obrigatoriedade por status:
 *  - Todos:        nome, origem, necessidade (telefone opcional — Kanban mostra aviso se vazio)
 *  - negociacao:   + email, servico_interesse, valor_bruto, vencimento, datas, cpf, possui_nota_fiscal
 *  - fechado:      + email, servico_interesse, valor_bruto, vencimento, datas
 *                  (cpf e possui_nota_fiscal são opcionais — badge visual exibida no Kanban quando ausentes)
 *  - perdido:      + motivo_perda
 *  - atendimento:  somente os campos base
 */
export function parseImportCsv(csvText: string): ImportRowResult[] {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const header = parseSemicolonCsvRow(lines[0]).map(h => h.replace(/^\uFEFF/, ''))
  const dataLines = lines.slice(1)

  const results: ImportRowResult[] = []

  if (dataLines.length > MAX_IMPORT_ROWS) {
    return [{
      rowIndex: 0,
      success: false,
      errors: [{ field: 'arquivo', message: `O arquivo contém ${dataLines.length} linhas. O máximo permitido é ${MAX_IMPORT_ROWS}.` }],
    }]
  }

  for (let i = 0; i < dataLines.length; i++) {
    const rowIndex = i + 2
    const cells = parseSemicolonCsvRow(dataLines[i])
    const row: Record<string, string> = {}
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = cells[j] ?? ''
    }

    const errors: ImportRowError[] = []

    // ── Normalização de todos os campos antes da validação ──
    const nome = normalizeNome(row['nome'] ?? '')
    const telefone = normalizeTelefone(row['telefone'] ?? '')
    const email = normalizeEmail(row['email'] ?? '')
    const contato_numero_raw = (row['contato_numero'] ?? '').trim()
    const contato_numero = contato_numero_raw ? normalizeEmail(contato_numero_raw) : null
    const cpf = normalizeCpf(row['cpf'] ?? '')
    const cnpj = normalizeCnpj(row['cnpj'] ?? '')
    const razao_social = (row['razao_social'] ?? '').trim()
    const origem = normalizeEnumField(row['origem'] ?? '')
    const indicacao_responsavel_nome = (row['indicacao_responsavel_nome'] ?? '').trim()
    const indicacao_responsavel_telefone_raw = row['indicacao_responsavel_telefone'] ?? ''
    const indicacao_responsavel_telefone = normalizeTelefone(indicacao_responsavel_telefone_raw)
    const necessidade = normalizeEnumField(row['necessidade'] ?? '')
    const servico_interesse = normalizeServicoInteresse(row['servico_interesse'] ?? '')
    const valor_bruto_str = normalizeValor(row['valor_bruto'] ?? '')
    const vencimento_str = normalizeVencimento(row['vencimento_dia'] ?? '')
    const data_inicio_raw = (row['data_inicio_contrato'] ?? '').trim()
    const data_fim_raw = (row['data_fim_contrato'] ?? '').trim()
    const data_inicio = data_inicio_raw ? normalizeDate(data_inicio_raw) : null
    const data_fim = data_fim_raw ? normalizeDate(data_fim_raw) : null
    const nota_fiscal = normalizeNotaFiscal(row['possui_nota_fiscal'] ?? '')
    const motivo_perda = (row['motivo_perda'] ?? '').trim()
    const status_raw = normalizeStatus(row['status'] ?? '')

    // ── Validação de status ──
    if (!status_raw) {
      errors.push({ field: 'status', message: `Status é obrigatório. Use: ${VALID_IMPORT_STATUSES.join(', ')}` })
    } else if (!VALID_IMPORT_STATUSES.includes(status_raw as ImportStatus)) {
      errors.push({ field: 'status', message: `Status inválido: "${status_raw}". Use: ${VALID_IMPORT_STATUSES.join(', ')}` })
    }
    const status = status_raw as ImportStatus

    // ── Campos obrigatórios para todos os status ──
    if (!nome) {
      errors.push({ field: 'nome', message: 'Nome é obrigatório' })
    }

    if (telefone && !isValidTelefoneImport(telefone)) {
      errors.push({ field: 'telefone', message: `Telefone inválido (${telefone.length} dígitos). Esperado: 10 (fixo) ou 11 (celular)` })
    }

    if (!origem) {
      errors.push({ field: 'origem', message: 'Origem é obrigatória' })
    } else if (!VALID_ORIGENS.includes(origem as LeadOrigem)) {
      errors.push({ field: 'origem', message: `Origem inválida: "${origem}". Use: ${VALID_ORIGENS.join(', ')}` })
    }

    if (!necessidade) {
      errors.push({ field: 'necessidade', message: 'Necessidade é obrigatória' })
    } else if (!VALID_NECESSIDADES.includes(necessidade as LeadNecessidade)) {
      errors.push({ field: 'necessidade', message: `Necessidade inválida: "${necessidade}". Use: ${VALID_NECESSIDADES.join(', ')}` })
    }

    if (indicacao_responsavel_telefone && !isValidTelefoneImport(indicacao_responsavel_telefone)) {
      errors.push({ field: 'indicacao_responsavel_telefone', message: 'Telefone do responsável da indicação inválido (esperado: 10 ou 11 dígitos)' })
    }

    // ── CPF/CNPJ (quando preenchidos) ──
    if (cpf && cpf.length !== 11) {
      errors.push({ field: 'cpf', message: `CPF deve ter 11 dígitos (encontrado: ${cpf.length})` })
    } else if (cpf && !isValidCpf(cpf)) {
      errors.push({ field: 'cpf', message: 'CPF inválido (dígitos verificadores incorretos)' })
    }

    if (cnpj && cnpj.length !== 14) {
      errors.push({ field: 'cnpj', message: `CNPJ deve ter 14 dígitos (encontrado: ${cnpj.length})` })
    } else if (cnpj && !isValidCnpj(cnpj)) {
      errors.push({ field: 'cnpj', message: 'CNPJ inválido (dígitos verificadores incorretos)' })
    }

    if (cnpj && !razao_social) {
      errors.push({ field: 'razao_social', message: 'Razão Social é obrigatória quando CNPJ está preenchido' })
    }

    // ── Campos obrigatórios para negociacao e fechado ──
    const requiresContractFields = status === 'negociacao' || status === 'fechado'
    if (requiresContractFields) {
      if (!email) {
        errors.push({ field: 'email', message: 'E-mail é obrigatório' })
      } else if (!isEmailValid(email)) {
        errors.push({ field: 'email', message: 'E-mail inválido' })
      }

      if (!servico_interesse) {
        errors.push({ field: 'servico_interesse', message: 'Serviço de interesse é obrigatório' })
      } else if (!VALID_SERVICOS.includes(servico_interesse as ServicoInteresse)) {
        errors.push({ field: 'servico_interesse', message: `Serviço inválido: "${servico_interesse}". Use: ${VALID_SERVICOS.join(', ')}` })
      }

      const valor_bruto_parsed = parseFloat(valor_bruto_str)
      if (!valor_bruto_str) {
        errors.push({ field: 'valor_bruto', message: 'Valor bruto é obrigatório' })
      } else if (isNaN(valor_bruto_parsed) || valor_bruto_parsed <= 0) {
        errors.push({ field: 'valor_bruto', message: 'Valor bruto inválido (deve ser número positivo)' })
      }

      const vencimento_parsed = parseInt(vencimento_str, 10)
      if (!vencimento_str) {
        errors.push({ field: 'vencimento_dia', message: 'Vencimento (dia) é obrigatório' })
      } else if (isNaN(vencimento_parsed) || vencimento_parsed < 0 || vencimento_parsed > 31) {
        errors.push({ field: 'vencimento_dia', message: 'Vencimento deve ser entre 0 e 31 (0 = pagamento integral)' })
      }

      if (!data_inicio_raw) {
        errors.push({ field: 'data_inicio_contrato', message: 'Data de início do contrato é obrigatória' })
      } else if (data_inicio === null) {
        errors.push({ field: 'data_inicio_contrato', message: 'Data de início não reconhecida. Use DD/MM/YYYY, DD-MM-YYYY ou YYYY-MM-DD' })
      }

      if (!data_fim_raw) {
        errors.push({ field: 'data_fim_contrato', message: 'Data de fim do contrato é obrigatória' })
      } else if (data_fim === null) {
        errors.push({ field: 'data_fim_contrato', message: 'Data de fim não reconhecida. Use DD/MM/YYYY, DD-MM-YYYY ou YYYY-MM-DD' })
      }

      if (data_inicio && data_fim && data_fim < data_inicio) {
        errors.push({ field: 'data_fim_contrato', message: 'Data de fim deve ser igual ou posterior à data de início' })
      }
    }

    // ── CPF e nota fiscal: obrigatórios apenas em negociacao ──
    if (status === 'negociacao') {
      if (!cpf) {
        errors.push({ field: 'cpf', message: 'CPF é obrigatório para status negociação' })
      }
      if (nota_fiscal === null) {
        errors.push({ field: 'possui_nota_fiscal', message: 'Possui nota fiscal é obrigatório (sim/s/1/true/yes ou nao/n/0/false/no)' })
      } else if (nota_fiscal === 'invalid') {
        errors.push({ field: 'possui_nota_fiscal', message: 'Valor não reconhecido. Use: sim/s/1/true/yes ou nao/n/0/false/no' })
      }
    } else if (nota_fiscal === 'invalid') {
      errors.push({ field: 'possui_nota_fiscal', message: 'Valor não reconhecido. Use: sim/s/1/true/yes ou nao/n/0/false/no' })
    }

    // ── E-mail: se preenchido em qualquer status, deve ser válido ──
    if (email && !requiresContractFields && !isEmailValid(email)) {
      errors.push({ field: 'email', message: 'E-mail inválido' })
    }

    // ── motivo_perda: obrigatório apenas em perdido ──
    if (status === 'perdido' && !motivo_perda) {
      errors.push({ field: 'motivo_perda', message: 'Motivo da perda é obrigatório quando status é "perdido"' })
    }

    if (errors.length > 0) {
      results.push({ rowIndex, success: false, errors })
      continue
    }

    // Valores numéricos já normalizados e validados
    const valor_bruto = requiresContractFields ? parseFloat(valor_bruto_str) : null
    const vencimento = requiresContractFields ? parseInt(vencimento_str, 10) : null

    results.push({
      rowIndex,
      success: true,
      errors: [],
      data: {
        status,
        nome,
        telefone,
        email: email || null,
        contato_numero,
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
        possui_nota_fiscal: nota_fiscal === 'true' ? true : nota_fiscal === 'false' ? false : null,
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
      // Garante que valor_liquido = valor_bruto quando não há desconto,
      // seguindo a mesma regra do cadastro manual via LeadDetail.
      valor_liquido: calculateValorLiquido(rest.valor_bruto, null),
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
