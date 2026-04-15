import { supabase } from '@/integrations/supabase/client'
import { LEAD_ORIGEM_LABELS, LEAD_ORIGEM_ORDER, SERVICO_LABELS } from '@/types'
import type { Lead, Perfil } from '@/types'

export type TimeFilter = 'hoje' | '7dias' | '30dias' | 'total'
export interface CustomDateRangeFilter {
  type: 'custom'
  from: string
  to: string
}
export interface PresetDateFilter {
  type: 'preset'
  preset: TimeFilter
}
export type DashboardDateFilter = PresetDateFilter | CustomDateRangeFilter
export type DashboardFilterInput = TimeFilter | DashboardDateFilter

export function isCustomDateRangeFilter(filter: DashboardFilterInput): filter is CustomDateRangeFilter {
  return typeof filter === 'object' && filter.type === 'custom'
}

export function toDashboardDateFilter(filter: DashboardFilterInput): DashboardDateFilter {
  if (typeof filter === 'string') {
    return { type: 'preset', preset: filter }
  }
  return filter
}

/** Limite inferior (inclusivo) de `created_at` para o filtro; `null` = sem filtro (Total). */
export function getCreatedAtLowerBoundIso(filter: TimeFilter): string | null {
  const now = new Date()
  if (filter === 'hoje') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  }
  if (filter === '7dias') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d.toISOString()
  }
  if (filter === '30dias') {
    const d = new Date(now)
    d.setDate(d.getDate() - 30)
    return d.toISOString()
  }
  return null
}

export interface CreatedAtBounds {
  lower: string | null
  upper: string | null
}

function toDayBoundsIso(fromIso: string, toIso: string): { lower: string; upper: string } {
  const lowerDate = new Date(fromIso)
  lowerDate.setHours(0, 0, 0, 0)

  const upperDate = new Date(toIso)
  upperDate.setHours(23, 59, 59, 999)

  if (lowerDate.getTime() <= upperDate.getTime()) {
    return { lower: lowerDate.toISOString(), upper: upperDate.toISOString() }
  }

  return { lower: upperDate.toISOString(), upper: lowerDate.toISOString() }
}

export function getCreatedAtBoundsIso(filter: DashboardFilterInput): CreatedAtBounds {
  const normalized = toDashboardDateFilter(filter)
  if (normalized.type === 'preset') {
    return { lower: getCreatedAtLowerBoundIso(normalized.preset), upper: null }
  }
  // Range customizado sempre inclui o dia inicial e o dia final completos.
  return toDayBoundsIso(normalized.from, normalized.to)
}

export async function fetchDashboardLeads(filter: DashboardFilterInput): Promise<Lead[]> {
  let query = supabase.from('leads').select('*')
  const { lower, upper } = getCreatedAtBoundsIso(filter)
  if (lower) query = query.gte('created_at', lower)
  if (upper) query = query.lte('created_at', upper)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data as Lead[]) || []
}

export async function fetchConsultoresAtivos(): Promise<Perfil[]> {
  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('role', 'consultor')
    .eq('status', 'ativo')
  if (error) throw new Error(error.message)
  return (data as Perfil[]) || []
}

export interface DashboardKpis {
  totalLeads: number
  /** (Fechados / (Total - Perdidos)) × 100 — Regras §3.1 */
  conversionRate: number
  negociosGanhos: number
  negociosPerdidos: number
  valorGanho: number
  valorPerdido: number
  totalDescontos: number
}

export function computeDashboardKpis(leads: Lead[]): DashboardKpis {
  const totalLeads = leads.length
  const fechados = leads.filter(l => l.status === 'fechado')
  const perdidos = leads.filter(l => l.status === 'perdido')
  const conversionRate =
    totalLeads > 0 ? Math.round((fechados.length / Math.max(totalLeads - perdidos.length, 1)) * 100) : 0
  const valorGanho = fechados
    .filter(l => l.status_financeiro === 'pago')
    .reduce((sum, l) => sum + (l.valor_liquido ?? 0), 0)
  const valorPerdido = perdidos
    .filter(l => l.valor_bruto != null)
    .reduce((sum, l) => sum + (l.valor_bruto ?? 0), 0)
  // Só computa desconto quando ambos os valores estão preenchidos.
  // Se valor_liquido é null (ex: lead importado sem desconto explícito), contribuição = 0.
  const totalDescontos = fechados.reduce((sum, l) => {
    if (l.valor_bruto == null || l.valor_liquido == null) return sum
    return sum + (l.valor_bruto - l.valor_liquido)
  }, 0)

  return {
    totalLeads,
    conversionRate,
    negociosGanhos: fechados.length,
    negociosPerdidos: perdidos.length,
    valorGanho,
    valorPerdido,
    totalDescontos,
  }
}

export interface DailyPoint {
  date: string
  leads: number
  ganhos: number
}

export function computeDailySeries(leads: Lead[]): DailyPoint[] {
  const days: Record<string, { leads: number; ganhos: number }> = {}
  for (const l of leads) {
    const d = l.created_at.split('T')[0]
    if (!days[d]) days[d] = { leads: 0, ganhos: 0 }
    days[d].leads++
    if (l.status === 'fechado') days[d].ganhos++
  }
  return Object.entries(days)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))
}

export interface OrigemBarPoint {
  name: string
  value: number
  key: string
}

export function computeLeadsPorOrigem(leads: Lead[]): OrigemBarPoint[] {
  return LEAD_ORIGEM_ORDER.map(o => ({
    name: LEAD_ORIGEM_LABELS[o],
    value: leads.filter(l => l.origem === o).length,
    key: o,
  }))
}

export function computeClientesPorOrigem(leads: Lead[]): OrigemBarPoint[] {
  const fechados = leads.filter(l => l.status === 'fechado')
  return LEAD_ORIGEM_ORDER.map(o => ({
    name: LEAD_ORIGEM_LABELS[o],
    value: fechados.filter(l => l.origem === o).length,
    key: o,
  }))
}

export interface ServicoBarRow {
  name: string
  value: number
}

export function computeLeadsPorServico(leads: Lead[]): ServicoBarRow[] {
  return Object.entries(SERVICO_LABELS)
    .map(([key, label]) => ({
      name: label,
      value: leads.filter(l => l.servico_interesse === key).length,
    }))
    .sort((a, b) => b.value - a.value)
}

export function computeClientesPorServico(leads: Lead[]): ServicoBarRow[] {
  const fechados = leads.filter(l => l.status === 'fechado')
  return Object.entries(SERVICO_LABELS)
    .map(([key, label]) => ({
      name: label,
      value: fechados.filter(l => l.servico_interesse === key).length,
    }))
    .sort((a, b) => b.value - a.value)
}

export interface ConsultorPerformanceRow {
  perfil: Perfil
  totalLeads: number
  ganhos: number
  /** Regras §3.4: (Ganhos / Leads) × 100 */
  conversaoPct: number
  valorGanho: number
  initials: string
}

export function computeConsultorPerformance(leads: Lead[], consultores: Perfil[]): ConsultorPerformanceRow[] {
  return consultores.map(c => {
    const cLeads = leads.filter(l => l.consultor_id === c.id)
    const cFechados = cLeads.filter(l => l.status === 'fechado')
    const conversaoPct =
      cLeads.length > 0 ? Math.round((cFechados.length / cLeads.length) * 100) : 0
    const valorGanho = cFechados
      .filter(l => l.status_financeiro === 'pago')
      .reduce((s, l) => s + (l.valor_liquido ?? 0), 0)
    const initials = c.nome_completo
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
    return {
      perfil: c,
      totalLeads: cLeads.length,
      ganhos: cFechados.length,
      conversaoPct,
      valorGanho,
      initials,
    }
  })
}
