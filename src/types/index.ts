export type Role = 'admin' | 'consultor'
export type LeadStatus = 'atendimento' | 'negociacao' | 'fechado' | 'perdido' | 'inativo'
export type LeadOrigem = 'indicacao' | 'google' | 'placa' | 'rede_social'
export type LeadNecessidade = 'escritorio_virtual' | 'salas' | 'endereco_fiscal' | 'coworking'
export type ServicoInteresse = 'plano_pro' | 'plano_premium' | 'plano_top' | 'coworking' | 'sala_special_room' | 'mini_sala_reuniao' | 'sala_reuniao_8' | 'sala_reuniao_12' | 'salas_fixas'
export type StatusFinanceiro = 'pago' | 'pendente'
export type MotivoPerdaTipo = 'parou_responder' | 'sem_interesse' | 'preco' | 'concorrencia' | 'outro'

export interface Perfil {
  id: string
  nome_completo: string
  email: string
  role: Role
  status: 'ativo' | 'inativo'
  ultimo_acesso: string | null
  created_at: string
}

export interface Lead {
  id: number
  consultor_id: string
  nome: string
  telefone: string
  origem: LeadOrigem
  necessidade: LeadNecessidade
  status: LeadStatus
  servico_interesse: ServicoInteresse | null
  valor_bruto: number | null
  porcentagem_desconto: number | null
  valor_liquido: number | null
  email: string | null
  rg: string | null
  cpf: string | null
  cnpj: string | null
  razao_social: string | null
  contato_numero: string | null
  socios: { nome: string; contato: string }[] | null
  status_financeiro: StatusFinanceiro | null
  data_prevista_pagamento: number | null
  motivo_perda_tipo: MotivoPerdaTipo | null
  motivo_perda_descricao: string | null
  created_at: string
  updated_at: string
  ultima_movimentacao_at: string | null
}

export interface HistoricoInteracao {
  id: number
  lead_id: number
  autor_id: string
  anotacao: string
  created_at: string
}

export interface DocumentoLead {
  id: number
  lead_id: number
  uploaded_by: string
  nome_descricao: string
  arquivo_url: string
  formato: 'doc' | 'docx' | 'jpg' | 'pdf'
  tamanho_bytes: number | null
  created_at: string
}

// Labels
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  atendimento: 'Atendimento',
  negociacao: 'Negociação',
  fechado: 'Fechado',
  perdido: 'Perdido',
  inativo: 'Inativo',
}

export const LEAD_ORIGEM_LABELS: Record<LeadOrigem, string> = {
  indicacao: 'Indicação',
  google: 'Google',
  placa: 'Placa',
  rede_social: 'Rede Social',
}

export const LEAD_NECESSIDADE_LABELS: Record<LeadNecessidade, string> = {
  escritorio_virtual: 'Escritório Virtual',
  salas: 'Salas',
  endereco_fiscal: 'Endereço Fiscal',
  coworking: 'Coworking',
}

export const SERVICO_LABELS: Record<ServicoInteresse, string> = {
  plano_pro: 'Plano Pro',
  plano_premium: 'Plano Premium',
  plano_top: 'Plano Top',
  coworking: 'Coworking',
  sala_special_room: 'Sala Special Room',
  mini_sala_reuniao: 'Mini Sala de Reunião',
  sala_reuniao_8: 'Sala de Reunião até 8',
  sala_reuniao_12: 'Sala de Reunião até 12',
  salas_fixas: 'Salas Fixas',
}

export const MOTIVO_PERDA_LABELS: Record<MotivoPerdaTipo, string> = {
  parou_responder: 'Parou de responder',
  sem_interesse: 'Sem interesse',
  preco: 'Preço',
  concorrencia: 'Concorrência',
  outro: 'Outro',
}

export const STATUS_FINANCEIRO_LABELS: Record<StatusFinanceiro, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
}
