import {
  normalizeServicoInteresse,
  normalizeDate,
  normalizeValor,
  normalizeVencimento,
  removeAccents,
} from '@/lib/csv-normalizers'
import { digitsOnly } from '@/lib/br-inputs'

// ---------------------------------------------------------------------------
// Cabeçalhos da planilha interna da Top Class
// ---------------------------------------------------------------------------

const TOP_CLASS_REQUIRED_HEADERS = [
  'Nome/Razão Social',
  'CNPJ/CPF',
  'Responsável',
  'Contato',
  'Email',
  'Plano',
  'Início',
  'Término',
  'Valor',
  'Venc.',
  'NF',
  'Contador',
  'Telefone',
] as const

// ---------------------------------------------------------------------------
// Cabeçalhos de saída (formato padrão CRM)
// ---------------------------------------------------------------------------

const CRM_HEADERS = [
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

// ---------------------------------------------------------------------------
// Utilitários de detecção
// ---------------------------------------------------------------------------

/**
 * Normaliza um cabeçalho removendo acentos, espaços extras, aspas e colocando em
 * minúsculas. Garante comparação tolerante a variações de codificação (UTF-8 vs
 * Windows-1252) e de formatação.
 */
function normalizeHeader(h: string): string {
  return removeAccents(h.trim().replace(/^"|"$/g, '').toLowerCase())
    .replace(/[-.]/g, '')
    .replace(/\s+/g, ' ')
}

/** Versão normalizada dos cabeçalhos obrigatórios da planilha Top Class. */
const TOP_CLASS_HEADERS_NORMALIZED = TOP_CLASS_REQUIRED_HEADERS.map(normalizeHeader)

/**
 * Detecta o separador dominante na linha de cabeçalho (`;` ou `,`).
 * Usa `;` em caso de empate, pois é o padrão do CRM.
 */
function detectSeparator(line: string): string {
  const semicolons = (line.match(/;/g) ?? []).length
  const commas = (line.match(/,/g) ?? []).length
  return commas > semicolons ? ',' : ';'
}

/**
 * Faz parse de uma linha CSV respeitando aspas e delimitadores dentro da célula.
 * Ex.: "a;b";c => ["a;b", "c"].
 */
function parseCsvRow(line: string, sep: string): string[] {
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

    if (char === sep && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

// ---------------------------------------------------------------------------
// Detecção da linha de cabeçalho
// ---------------------------------------------------------------------------

/** Quebra o texto CSV em linhas normalizando terminadores de linha. */
function toLines(csvText: string): string[] {
  return csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

/** Número máximo de linhas a escanear para encontrar o cabeçalho. */
const MAX_HEADER_SCAN = 15

/**
 * Escaneia as primeiras linhas do CSV para encontrar a linha que contém todos
 * os cabeçalhos obrigatórios da planilha Top Class. Planilhas internas
 * frequentemente possuem linhas de título/metadados antes dos cabeçalhos.
 *
 * Retorna o índice da linha de cabeçalho (0-based) ou -1 se não encontrar.
 */
export function findHeaderRow(csvText: string): number {
  const lines = toLines(csvText)
  const limit = Math.min(lines.length, MAX_HEADER_SCAN)

  for (let i = 0; i < limit; i++) {
    const line = lines[i].replace(/^\uFEFF/, '')
    if (!line.trim()) continue
    const sep = detectSeparator(line)
    const headers = parseCsvRow(line, sep).map(normalizeHeader)
    if (TOP_CLASS_HEADERS_NORMALIZED.every(req => headers.includes(req))) {
      return i
    }
  }

  return -1
}

/**
 * Retorna true se o CSV fornecido corresponde à planilha interna da Top Class.
 * Escaneia até as primeiras 15 linhas para tolerar títulos/metadados no topo.
 */
export function isTopClassSheet(csvText: string): boolean {
  return findHeaderRow(csvText) !== -1
}

// ---------------------------------------------------------------------------
// Inferência de necessidade a partir do serviço
// ---------------------------------------------------------------------------

const SERVICOS_ESCRITORIO = new Set(['plano_pro', 'plano_premium', 'plano_top'])
const SERVICOS_COWORKING = new Set([
  'coworking_hora',
  'coworking_turno',
  'coworking_diaria',
  'coworking_mensal_4h',
  'coworking_mensal_8h',
])
const SERVICOS_SALAS = new Set([
  'sala_special_room',
  'mini_sala_reuniao',
  'sala_reuniao_8',
  'sala_reuniao_12',
  'salas_fixas',
])

function inferNecessidade(servicoNormalizado: string): string {
  if (SERVICOS_ESCRITORIO.has(servicoNormalizado)) return 'escritorio_virtual'
  if (SERVICOS_COWORKING.has(servicoNormalizado)) return 'coworking'
  if (SERVICOS_SALAS.has(servicoNormalizado)) return 'salas'
  // Fallback: escritorio_virtual para serviços não reconhecidos
  return 'escritorio_virtual'
}

// ---------------------------------------------------------------------------
// Mapeamento da coluna Contador → origem + indicacao_responsavel_nome
// ---------------------------------------------------------------------------

const GOOGLE_SITE_PATTERN = /^(google|site)$/i

function mapContador(raw: string): { origem: string; indicacaoNome: string } {
  const normalizado = removeAccents(raw.trim().toLowerCase())

  if (!normalizado || normalizado === 'sem indicacao' || normalizado === 'sem indicação') {
    return { origem: 'outros', indicacaoNome: '' }
  }

  if (GOOGLE_SITE_PATTERN.test(normalizado)) {
    return { origem: 'google', indicacaoNome: '' }
  }

  return { origem: 'indicacao', indicacaoNome: raw.trim() }
}

// ---------------------------------------------------------------------------
// Coluna NF → possui_nota_fiscal (valores livres da planilha interna)
// ---------------------------------------------------------------------------

/**
 * Converte rótulos da coluna `NF` da planilha Top Class para valores que
 * `normalizeNotaFiscal` já reconhece. Demais valores seguem inalterados.
 */
function mapTopClassNf(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const v = removeAccents(trimmed.toLowerCase())
  if (v === 'emitir') return 'sim'
  if (v === 'isento' || v === 'isenta') return 'nao'
  return trimmed
}

// ---------------------------------------------------------------------------
// Conversão de datas seriais do Excel → YYYY-MM-DD
// ---------------------------------------------------------------------------

const EXCEL_EPOCH = new Date(1899, 11, 30).getTime()

/**
 * Converte um número serial do Excel (ex: 45779) para data YYYY-MM-DD.
 * Se o valor não for um serial válido, retorna null.
 */
function excelSerialToDate(raw: string): string | null {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1 || n > 100000) return null
  const ms = EXCEL_EPOCH + n * 86400000
  const d = new Date(ms)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Tenta parsear data no formato M/D/YY ou M/D/YYYY (padrão US que o Excel
 * pode gerar ao exportar CSV). Retorna YYYY-MM-DD ou null.
 */
function parseUsShortDate(raw: string): string | null {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!match) return null
  const [, mStr, dStr, yStr] = match
  const month = parseInt(mStr, 10)
  const day = parseInt(dStr, 10)
  let year = parseInt(yStr, 10)
  if (year < 100) year += 2000
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  const yyyy = String(year)
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Tenta normalizar uma data: serial Excel → M/D/YY (US) → formatos padrão BR.
 */
function smartNormalizeDate(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const fromSerial = excelSerialToDate(trimmed)
  if (fromSerial) return fromSerial
  const fromUs = parseUsShortDate(trimmed)
  if (fromUs) return fromUs
  return normalizeDate(trimmed) ?? trimmed
}

// ---------------------------------------------------------------------------
// Limpeza de email (multi-email, fallback)
// ---------------------------------------------------------------------------

const EMAIL_FALLBACK = 'vazio@gmail.com'

/**
 * Primeiro e-mail para o campo principal; segundo para Contato Adicional (`contato_numero`).
 * Separadores: `/` ou `;`. Campo vazio → e-mail placeholder.
 */
function parseEmailsFromCell(raw: string): { primary: string; contatoAdicional: string } {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { primary: EMAIL_FALLBACK, contatoAdicional: '' }
  }
  const parts = trimmed.split(/[/;]/).map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    return { primary: EMAIL_FALLBACK, contatoAdicional: '' }
  }
  if (parts.length === 1) {
    return { primary: parts[0], contatoAdicional: '' }
  }
  return { primary: parts[0], contatoAdicional: parts[1] }
}

/**
 * Primeiro telefone para o campo principal; segundo para Contato Adicional (`contato_numero`).
 * Separadores: `/` ou `;`.
 */
function parsePhonesFromCell(raw: string): { primary: string; contatoAdicional: string } {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { primary: '', contatoAdicional: '' }
  }
  const parts = trimmed.split(/[/;]/).map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    return { primary: '', contatoAdicional: '' }
  }
  if (parts.length === 1) {
    return { primary: parts[0], contatoAdicional: '' }
  }
  return { primary: parts[0], contatoAdicional: parts[1] }
}

// ---------------------------------------------------------------------------
// Utilitário de escape de célula CSV
// ---------------------------------------------------------------------------

function escapeCsvCell(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ---------------------------------------------------------------------------
// Mapeamento principal
// ---------------------------------------------------------------------------

/**
 * Converte o CSV da planilha interna da Top Class para o formato padrão do CRM,
 * pronto para ser processado por `parseImportCsv`.
 *
 * Pré-condição: o texto deve ter passado por `isTopClassSheet`.
 */
export function mapTopClassSheet(csvText: string): string {
  const allLines = toLines(csvText)

  const headerIdx = findHeaderRow(csvText)
  if (headerIdx === -1) return ''

  const rawHeader = allLines[headerIdx].replace(/^\uFEFF/, '')
  const sep = detectSeparator(rawHeader)

  const rawHeaders = parseCsvRow(rawHeader, sep).map(h => h.trim())
  const normalizedIndex = new Map<string, number>()
  rawHeaders.forEach((h, i) => normalizedIndex.set(normalizeHeader(h), i))

  const idx = (col: string): number => normalizedIndex.get(normalizeHeader(col)) ?? -1

  // Linhas de dados começam logo após o cabeçalho, ignorando linhas vazias
  const dataLines = allLines.slice(headerIdx + 1).filter(l => l.trim())

  const outputLines: string[] = [CRM_HEADERS.join(';')]

  for (let i = 0; i < dataLines.length; i++) {
    const cells = parseCsvRow(dataLines[i], sep)

    const get = (col: string): string => cells[idx(col)] ?? ''

    // ── Identidade (CPF vs CNPJ) ──
    const docRaw = digitsOnly(get('CNPJ/CPF'))
    const isCnpj = docRaw.length === 14
    const isCpf = docRaw.length === 11

    const nomeRazaoSocial = get('Nome/Razão Social').trim()
    const responsavel = get('Responsável').trim()

    let nome: string
    let cpf: string
    let cnpj: string
    let razaoSocial: string

    if (isCnpj) {
      cnpj = docRaw
      razaoSocial = nomeRazaoSocial
      nome = responsavel
      cpf = ''
    } else if (isCpf) {
      cpf = docRaw
      nome = nomeRazaoSocial
      cnpj = ''
      razaoSocial = ''
    } else {
      // Documento ausente ou com número inesperado de dígitos: usa nome como fallback
      cpf = ''
      cnpj = ''
      nome = nomeRazaoSocial || responsavel
      razaoSocial = ''
    }

    // ── Origem (Contador) ──
    const { origem, indicacaoNome } = mapContador(get('Contador'))
    const indicacaoTelefone = origem === 'indicacao' ? get('Telefone').trim() : ''

    // ── Serviço e necessidade ──
    const servicoNorm = normalizeServicoInteresse(get('Plano'))
    const necessidade = inferNecessidade(servicoNorm)

    // ── Datas (suporta serial Excel e formatos DD/MM/YYYY, YYYY-MM-DD, etc.) ──
    const dataInicio = smartNormalizeDate(get('Início'))
    const dataFim = smartNormalizeDate(get('Término'))

    // ── Valor e vencimento (vazio → 0 = pagamento integral) ──
    const valorBruto = normalizeValor(get('Valor'))
    const vencRaw = normalizeVencimento(get('Venc.'))
    const vencimento = vencRaw || '0'

    // ── NF (emitir → sim; isento/isenta → não; demais → parseImportCsv normaliza) ──
    const nf = mapTopClassNf(get('NF'))

    const { primary: email, contatoAdicional: emailAdicional } = parseEmailsFromCell(get('Email'))
    const { primary: telefone, contatoAdicional: telefoneAdicional } = parsePhonesFromCell(get('Contato'))
    const contatoAdicional = [emailAdicional, telefoneAdicional].filter(Boolean).join(' / ')

    const row: string[] = [
      'fechado',          // status — fixo para esta planilha
      escapeCsvCell(nome),
      telefone,
      email,
      escapeCsvCell(contatoAdicional),
      cpf,
      cnpj,
      escapeCsvCell(razaoSocial),
      origem,
      escapeCsvCell(indicacaoNome),
      indicacaoTelefone,
      necessidade,
      servicoNorm,
      valorBruto,
      vencimento,
      dataInicio,
      dataFim,
      nf,
      '',                 // motivo_perda — não se aplica (status = fechado)
    ]

    outputLines.push(row.join(';'))
  }

  return '\uFEFF' + outputLines.join('\r\n')
}
