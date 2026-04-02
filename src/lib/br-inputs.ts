import { z } from 'zod'

/** Apenas dígitos. */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

// ---------------------------------------------------------------------------
// Telefone — (DD) 9XXXX-XXXX (11 dígitos, DDD + celular 9)
// ---------------------------------------------------------------------------

export function formatTelefoneBrMobile(value: string): string {
  const d = digitsOnly(value).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return d.length === 2 ? `(${d})` : `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function subscriberDigitsAllSame(sub9: string): boolean {
  return /^(\d)\1{8}$/.test(sub9)
}

export function isValidTelefoneBrMobile(value: string): boolean {
  const d = digitsOnly(value)
  if (d.length !== 11) return false
  const ddd = d.slice(0, 2)
  if (!/^[1-9]{2}$/.test(ddd)) return false
  if (d[2] !== '9') return false
  const sub = d.slice(3)
  if (sub === '000000000') return false
  if (subscriberDigitsAllSame(sub)) return false
  return true
}

export const telefoneBrMobileSchema = z.string().refine(isValidTelefoneBrMobile, {
  message: 'Celular inválido. Use (DD) 9XXXX-XXXX',
})

// ---------------------------------------------------------------------------
// E-mail — regex restritiva, TLD ≥ 2, sem espaços, minúsculas
// ---------------------------------------------------------------------------

export function normalizeEmailInput(value: string): string {
  return value.replace(/\s/g, '').toLowerCase()
}

export function isValidEmailBr(value: string): boolean {
  const v = normalizeEmailInput(value)
  if (v.length === 0) return false
  const at = v.indexOf('@')
  if (at <= 0 || at !== v.lastIndexOf('@')) return false
  const local = v.slice(0, at)
  const domain = v.slice(at + 1)
  if (!local || !domain) return false
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(local)) return false
  const domainParts = domain.split('.')
  if (domainParts.length < 2) return false
  const tld = domainParts[domainParts.length - 1]
  if (tld.length < 2) return false
  for (const part of domainParts) {
    if (!part || part.length > 63) return false
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(part)) return false
  }
  return true
}

export const emailBrSchema = z.string().min(1).refine(isValidEmailBr, {
  message: 'E-mail inválido',
})

// ---------------------------------------------------------------------------
// RG — sem máscara fixa; 7–9 caracteres; letra só no DV (último caractere)
// ---------------------------------------------------------------------------

export function sanitizeRgInput(raw: string): string {
  return raw.replace(/\s/g, '').replace(/[^0-9A-Za-z.\-/]/g, '')
}

function normalizeRgAlnum(s: string): string {
  return s.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
}

export function isValidRg(value: string): boolean {
  const v = normalizeRgAlnum(value)
  if (v.length < 7 || v.length > 9) return false
  const last = v[v.length - 1]
  const lastIsLetter = /[A-Z]/.test(last)
  if (lastIsLetter) {
    const nums = v.slice(0, -1)
    return /^\d{6,8}$/.test(nums)
  }
  return /^\d{7,9}$/.test(v)
}

export const rgBrSchema = z.string().min(1).refine(isValidRg, {
  message: 'RG inválido (7 a 9 caracteres; letra apenas no final, se houver)',
})

// ---------------------------------------------------------------------------
// CPF
// ---------------------------------------------------------------------------

export function formatCpf(value: string): string {
  const d = digitsOnly(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function cpfCheckDigitsOk(d: string): boolean {
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i)
  let mod = (sum * 10) % 11
  if (mod === 10) mod = 0
  if (mod !== parseInt(d[9], 10)) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i)
  mod = (sum * 10) % 11
  if (mod === 10) mod = 0
  return mod === parseInt(d[10], 10)
}

export function isValidCpf(value: string): boolean {
  const d = digitsOnly(value)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false
  return cpfCheckDigitsOk(d)
}

export const cpfBrSchema = z.string().min(1).refine(isValidCpf, {
  message: 'CPF inválido',
})

// ---------------------------------------------------------------------------
// CNPJ
// ---------------------------------------------------------------------------

export function formatCnpj(value: string): string {
  const d = digitsOnly(value).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function cnpjCheckDigitsOk(d: string): boolean {
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) sum += parseInt(d[i], 10) * w1[i]
  let mod = sum % 11
  const dv1 = mod < 2 ? 0 : 11 - mod
  if (dv1 !== parseInt(d[12], 10)) return false
  sum = 0
  for (let i = 0; i < 13; i++) sum += parseInt(d[i], 10) * w2[i]
  mod = sum % 11
  const dv2 = mod < 2 ? 0 : 11 - mod
  return dv2 === parseInt(d[13], 10)
}

export function isValidCnpj(value: string): boolean {
  const d = digitsOnly(value)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false
  return cnpjCheckDigitsOk(d)
}

export const cnpjBrSchema = z.string().min(1).refine(isValidCnpj, {
  message: 'CNPJ inválido',
})
