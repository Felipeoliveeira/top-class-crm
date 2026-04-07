import { supabase } from '@/integrations/supabase/client'
import {
  isValidCnpj,
  isValidCpf,
  isValidEmailBr,
  isValidRg,
  isValidTelefoneBrMobile,
} from '@/lib/br-inputs'
import type { Lead, LeadStatus, MotivoPerdaTipo, Perfil } from '@/types'

// ---------------------------------------------------------------------------
// Constantes de domínio
// ---------------------------------------------------------------------------

export const PIPELINE_STAGES: LeadStatus[] = ['atendimento', 'negociacao', 'fechado', 'perdido']

/**
 * Mapa de transições válidas conforme Regras de Progressão §2.6.
 * Qualquer transição fora deste mapa é proibida.
 */
export const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  atendimento: ['negociacao', 'perdido'],
  negociacao: ['fechado', 'perdido'],
  fechado: ['inativo'],
  perdido: [],
  inativo: [],
}

/** Campos editáveis do lead para `update` (exceto `status`). */
export function leadPersistPayload(lead: Lead) {
  return {
    nome: lead.nome,
    telefone: lead.telefone,
    origem: lead.origem,
    necessidade: lead.necessidade,
    consultor_id: lead.consultor_id,
    servico_interesse: lead.servico_interesse,
    valor_bruto: lead.valor_bruto,
    porcentagem_desconto: lead.porcentagem_desconto,
    valor_liquido: lead.valor_liquido,
    email: lead.email,
    rg: lead.rg,
    cpf: lead.cpf,
    cnpj: lead.cnpj,
    razao_social: lead.razao_social,
    contato_numero: lead.contato_numero,
    socios: lead.socios,
    status_financeiro: lead.status_financeiro,
    data_prevista_pagamento: lead.data_prevista_pagamento,
    data_inicio_contrato: lead.data_inicio_contrato,
    data_fim_contrato: lead.data_fim_contrato,
    possui_nota_fiscal: lead.possui_nota_fiscal,
    motivo_perda_tipo: lead.motivo_perda_tipo,
    motivo_perda_descricao: lead.motivo_perda_descricao,
    indicacao_responsavel_nome: lead.indicacao_responsavel_nome,
    indicacao_responsavel_telefone: lead.indicacao_responsavel_telefone,
  }
}

// ---------------------------------------------------------------------------
// Erros customizados
// ---------------------------------------------------------------------------

export class GateValidationError extends Error {
  missingFields: string[]
  constructor(missingFields: string[]) {
    super(`Campos obrigatórios faltando: ${missingFields.join(', ')}`)
    this.name = 'GateValidationError'
    this.missingFields = missingFields
  }
}

export class TransitionNotAllowedError extends Error {
  constructor(from: LeadStatus, to: LeadStatus) {
    super(`Transição de "${from}" para "${to}" não é permitida.`)
    this.name = 'TransitionNotAllowedError'
  }
}

// ---------------------------------------------------------------------------
// Validações de transição e gates
// ---------------------------------------------------------------------------

export function isTransitionAllowed(from: LeadStatus, to: LeadStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

/** Gates: Atendimento → Negociação (origem + necessidade) */
export function validateAtendimentoToNegociacao(lead: Lead): string[] {
  const missing: string[] = []
  if (!lead.origem) missing.push('Origem')
  if (!lead.necessidade) missing.push('Serviço de Interesse')
  if (!isValidTelefoneBrMobile(lead.telefone)) {
    missing.push('Telefone (celular válido: (DD) 9XXXX-XXXX)')
  }
  return missing
}

/** Gates: Negociação → Fechado (serviço, dados pessoais, PJ, docs, pagamento) */
export async function validateNegociacaoToFechado(lead: Lead): Promise<string[]> {
  const missing: string[] = []

  if (!lead.servico_interesse) missing.push('Plano')
  if (!lead.valor_bruto) missing.push('Valor Bruto')
  if (!lead.email) missing.push('E-mail')
  else if (!isValidEmailBr(lead.email)) missing.push('E-mail (formato inválido)')

  if (!lead.rg) missing.push('RG')
  else if (!isValidRg(lead.rg)) missing.push('RG (inválido)')

  if (!lead.cpf) missing.push('CPF')
  else if (!isValidCpf(lead.cpf)) missing.push('CPF (inválido)')

  // PJ: se CNPJ preenchido, razão social é obrigatória
  if (lead.cnpj) {
    if (!isValidCnpj(lead.cnpj)) missing.push('CNPJ (inválido)')
    if (!lead.razao_social) missing.push('Razão Social (PJ)')
  }

  // Ao menos 1 documento no Storage
  const { count } = await supabase
    .from('documentos_lead')
    .select('*', { count: 'exact', head: true })
    .eq('lead_id', lead.id)
  if (!count || count === 0) missing.push('Ao menos 1 documento enviado')

  // Status financeiro = pago
  if (lead.status_financeiro !== 'pago') missing.push('Status Financeiro = Pago')

  const venc = lead.data_prevista_pagamento
  if (venc == null || venc < 1 || venc > 31) missing.push('Vencimento')

  if (!lead.data_inicio_contrato?.trim()) missing.push('Data início do contrato')
  if (!lead.data_fim_contrato?.trim()) missing.push('Data fim do contrato')
  if (
    lead.data_inicio_contrato &&
    lead.data_fim_contrato &&
    lead.data_fim_contrato < lead.data_inicio_contrato
  ) {
    missing.push('Data fim do contrato deve ser igual ou posterior à data de início')
  }

  if (lead.possui_nota_fiscal !== true && lead.possui_nota_fiscal !== false) {
    missing.push('Emite Nota Fiscal?')
  }

  return missing
}

/**
 * Valida gates para qualquer transição.
 * Retorna lista de campos faltantes (vazia = pode avançar).
 */
export async function validateTransition(lead: Lead, targetStatus: LeadStatus): Promise<string[]> {
  if (lead.status === 'atendimento' && targetStatus === 'negociacao') {
    return validateAtendimentoToNegociacao(lead)
  }
  if (lead.status === 'negociacao' && targetStatus === 'fechado') {
    return validateNegociacaoToFechado(lead)
  }
  return []
}

// ---------------------------------------------------------------------------
// Helpers de cálculo
// ---------------------------------------------------------------------------

export function calculateValorLiquido(
  valorBruto: number | null,
  porcentagemDesconto: number | null,
): number | null {
  if (valorBruto == null) return null
  if (porcentagemDesconto == null || porcentagemDesconto === 0) return valorBruto
  return Math.round(valorBruto * (1 - porcentagemDesconto / 100) * 100) / 100
}

// ---------------------------------------------------------------------------
// Funções de dados (Supabase queries)
// ---------------------------------------------------------------------------

export async function fetchLeadsByStatus(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data as Lead[]) ?? []
}

export async function fetchActiveConsultores(): Promise<Perfil[]> {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome_completo, email, role, status, ultimo_acesso, created_at')
    .in('role', ['consultor', 'admin'])
    .eq('status', 'ativo')
    .order('nome_completo')

  if (error) throw new Error(error.message)
  return (data as Perfil[]) ?? []
}

export interface CreateLeadInput {
  nome: string
  telefone: string
  consultor_id: string
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .insert({
      nome: input.nome,
      telefone: input.telefone,
      consultor_id: input.consultor_id,
      status: 'atendimento',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Lead
}

/**
 * Avança o lead para o estágio alvo após validar transição e gates.
 * Lança GateValidationError se houver campos faltantes.
 * Lança TransitionNotAllowedError se a transição é proibida.
 */
export async function advanceStage(lead: Lead, targetStatus: LeadStatus): Promise<Lead> {
  if (!isTransitionAllowed(lead.status, targetStatus)) {
    throw new TransitionNotAllowedError(lead.status, targetStatus)
  }

  const missingFields = await validateTransition(lead, targetStatus)
  if (missingFields.length > 0) {
    throw new GateValidationError(missingFields)
  }

  const { data, error } = await supabase
    .from('leads')
    .update({
      ...leadPersistPayload(lead),
      status: targetStatus,
    })
    .eq('id', lead.id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Lead
}

export interface MarkAsLostInput {
  motivo_perda_tipo: MotivoPerdaTipo
  motivo_perda_descricao?: string | null
}

/**
 * Marca o lead como Perdido com motivo obrigatório.
 * Disponível apenas em Atendimento e Negociação.
 */
export async function markAsLost(lead: Lead, input: MarkAsLostInput): Promise<Lead> {
  if (!isTransitionAllowed(lead.status, 'perdido')) {
    throw new TransitionNotAllowedError(lead.status, 'perdido')
  }

  const { data, error } = await supabase
    .from('leads')
    .update({
      status: 'perdido' as const,
      motivo_perda_tipo: input.motivo_perda_tipo,
      motivo_perda_descricao: input.motivo_perda_tipo === 'outro'
        ? input.motivo_perda_descricao
        : null,
    })
    .eq('id', lead.id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Lead
}

/**
 * Inativa um cliente (churn) — disponível apenas para leads com status 'fechado'.
 */
export async function inactivateLead(lead: Lead): Promise<Lead> {
  if (!isTransitionAllowed(lead.status, 'inativo')) {
    throw new TransitionNotAllowedError(lead.status, 'inativo')
  }

  const { data, error } = await supabase
    .from('leads')
    .update({ status: 'inativo' as const })
    .eq('id', lead.id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Lead
}

// ---------------------------------------------------------------------------
// Helpers de nomes (perfis)
// ---------------------------------------------------------------------------

export async function fetchAllPerfisNames(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome_completo')

  if (error) throw new Error(error.message)
  const map: Record<string, string> = {}
  data?.forEach(p => { map[p.id] = p.nome_completo })
  return map
}
