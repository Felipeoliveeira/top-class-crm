import { digitsOnly, normalizeEmailInput, isValidEmailBr } from '@/lib/br-inputs'

/**
 * Remove acentos e diacríticos de uma string.
 * Ex.: "negociação" → "negociacao", "Indicação" → "Indicacao"
 */
export function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ---------------------------------------------------------------------------
// Normalizadores individuais por campo
// ---------------------------------------------------------------------------

export function normalizeNome(raw: string): string {
  return raw.trim()
}

/**
 * Remove tudo que não é dígito.
 * Resultado esperado: 10 dígitos (fixo) ou 11 dígitos (celular).
 */
export function normalizeTelefone(raw: string): string {
  return digitsOnly(raw.trim())
}

/** Remove tudo que não é dígito. Resultado esperado: 11 dígitos. */
export function normalizeCpf(raw: string): string {
  return digitsOnly(raw.trim())
}

/** Remove tudo que não é dígito. Resultado esperado: 14 dígitos. */
export function normalizeCnpj(raw: string): string {
  return digitsOnly(raw.trim())
}

/** Trim + lowercase. Usa normalizeEmailInput de br-inputs. */
export function normalizeEmail(raw: string): string {
  return normalizeEmailInput(raw.trim())
}

/**
 * Aceita formatos como "R$ 1.200,50", "1200.50", "1200,50", "1200".
 * Retorna a string numérica limpa pronta para parseFloat, ou a string original se não conseguir limpar.
 */
export function normalizeValor(raw: string): string {
  let v = raw.trim()
  v = v.replace(/^R\$\s*/i, '')

  // Detecta formato brasileiro: 1.200,50 (ponto como milhar, vírgula como decimal)
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(v)) {
    v = v.replace(/\./g, '').replace(',', '.')
    return v
  }

  // Formato com vírgula decimal sem pontos de milhar: 1200,50
  if (/^\d+(,\d+)$/.test(v)) {
    v = v.replace(',', '.')
    return v
  }

  // Já está em formato numérico padrão: 1200.50 ou 1200
  return v.replace(/\s/g, '')
}

/**
 * Extrai apenas os dígitos e retorna o número inteiro como string.
 * Ex.: "dia 10", "10º", "10" → "10"
 */
export function normalizeVencimento(raw: string): string {
  return digitsOnly(raw.trim())
}

/**
 * Aceita DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD.
 * Normaliza para YYYY-MM-DD. Retorna null se não reconhecer.
 */
export function normalizeDate(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null

  // YYYY-MM-DD (já no formato correto)
  const isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    if (isValidDateParts(y, m, d)) return `${y}-${m}-${d}`
    return null
  }

  // DD/MM/YYYY
  const slashMatch = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (slashMatch) {
    const [, d, m, y] = slashMatch
    if (isValidDateParts(y, m, d)) return `${y}-${m}-${d}`
    return null
  }

  // DD-MM-YYYY
  const dashMatch = v.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dashMatch) {
    const [, d, m, y] = dashMatch
    if (isValidDateParts(y, m, d)) return `${y}-${m}-${d}`
    return null
  }

  return null
}

function isValidDateParts(y: string, m: string, d: string): boolean {
  const year = parseInt(y, 10)
  const month = parseInt(m, 10)
  const day = parseInt(d, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

const TRUTHY = new Set(['sim', 's', '1', 'true', 'yes'])
const FALSY = new Set(['nao', 'n', '0', 'false', 'no'])

/**
 * Normaliza campo booleano de nota fiscal.
 * Retorna 'true', 'false', null (vazio) ou 'invalid' (preenchido mas não reconhecido).
 * removeAccents converte "não" → "nao" antes da verificação.
 */
export function normalizeNotaFiscal(raw: string): 'true' | 'false' | null | 'invalid' {
  const v = removeAccents(raw.trim().toLowerCase())
  if (!v) return null
  if (TRUTHY.has(v)) return 'true'
  if (FALSY.has(v)) return 'false'
  return 'invalid'
}

/**
 * Normaliza status: trim, lowercase, remove acentos.
 * "Negociação" → "negociacao", " FECHADO " → "fechado"
 */
export function normalizeStatus(raw: string): string {
  return removeAccents(raw.trim().toLowerCase())
}

/**
 * Normaliza campos de enum genéricos (origem, necessidade):
 * trim, lowercase, remove acentos, substitui espaços por _.
 */
export function normalizeEnumField(raw: string): string {
  return removeAccents(raw.trim().toLowerCase()).replace(/\s+/g, '_')
}

// ---------------------------------------------------------------------------
// Normalização de servico_interesse com mapeamento de aliases
// ---------------------------------------------------------------------------

const SERVICO_ALIASES: Record<string, string> = {
  // Plano Pro
  'pro': 'plano_pro',
  'plano_pro': 'plano_pro',
  'virtual_pro': 'plano_pro',
  'escritorio_virtual_pro': 'plano_pro',

  // Plano Premium
  'premium': 'plano_premium',
  'plano_premium': 'plano_premium',
  'virtual_premium': 'plano_premium',
  'escritorio_virtual_premium': 'plano_premium',

  // Plano Top
  'top': 'plano_top',
  'plano_top': 'plano_top',
  'virtual_top': 'plano_top',
  'escritorio_virtual_top': 'plano_top',

  // Coworking (slugs canônicos + rótulos normalizados por normalizeEnumField)
  'coworking_hora': 'coworking_hora',
  'coworking_turno': 'coworking_turno',
  'coworking_diaria': 'coworking_diaria',
  'coworking_mensal_4h': 'coworking_mensal_4h',
  'coworking_mensal_8h': 'coworking_mensal_8h',
  'coworking_-_hora': 'coworking_hora',
  'coworking_-_turno': 'coworking_turno',
  'coworking_-_diaria': 'coworking_diaria',
  'coworking_mensal_-_4_horas': 'coworking_mensal_4h',
  'coworking_mensal_-_8_horas': 'coworking_mensal_8h',
  'coworking_mensal_4_horas': 'coworking_mensal_4h',
  'coworking_mensal_8_horas': 'coworking_mensal_8h',
  // Genérico / legado → diária (valor neutro quando o CSV não discrimina o plano)
  'coworking': 'coworking_diaria',
  'co_working': 'coworking_diaria',
  'co-working': 'coworking_diaria',

  // Sala Special Room
  'sala_special_room': 'sala_special_room',
  'special_room': 'sala_special_room',
  'special': 'sala_special_room',
  'sala_special': 'sala_special_room',

  // Mini Sala de Reunião
  'mini_sala_reuniao': 'mini_sala_reuniao',
  'mini_sala': 'mini_sala_reuniao',
  'mini_sala_de_reuniao': 'mini_sala_reuniao',
  'mini_reuniao': 'mini_sala_reuniao',

  // Sala de Reunião até 8
  'sala_reuniao_8': 'sala_reuniao_8',
  'sala_reuniao_ate_8': 'sala_reuniao_8',
  'reuniao_8': 'sala_reuniao_8',
  'sala_8': 'sala_reuniao_8',

  // Sala de Reunião até 12
  'sala_reuniao_12': 'sala_reuniao_12',
  'sala_reuniao_ate_12': 'sala_reuniao_12',
  'reuniao_12': 'sala_reuniao_12',
  'sala_12': 'sala_reuniao_12',

  // Salas Fixas
  'salas_fixas': 'salas_fixas',
  'sala_fixa': 'salas_fixas',
  'fixas': 'salas_fixas',
  'fixa': 'salas_fixas',
}

/**
 * Normaliza servico_interesse tentando resolver aliases comuns.
 * Ex.: "Premium" → "plano_premium", "Virtual Pro" → "plano_pro"
 */
export function normalizeServicoInteresse(raw: string): string {
  const normalized = normalizeEnumField(raw)
  if (!normalized) return ''
  return SERVICO_ALIASES[normalized] ?? normalized
}

// ---------------------------------------------------------------------------
// Validação de e-mail (reutiliza br-inputs)
// ---------------------------------------------------------------------------

export function isEmailValid(email: string): boolean {
  if (!email) return true
  return isValidEmailBr(email)
}

// ---------------------------------------------------------------------------
// Validação de telefone para import (aceita 10 ou 11 dígitos)
// ---------------------------------------------------------------------------

export function isValidTelefoneImport(digitsOnlyPhone: string): boolean {
  if (digitsOnlyPhone.length < 10 || digitsOnlyPhone.length > 11) return false
  return /^[1-9]{2}\d{8,9}$/.test(digitsOnlyPhone)
}
