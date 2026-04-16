import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  fetchDashboardLeads,
  fetchConsultoresAtivos,
  type DashboardFilterInput,
  toDashboardDateFilter,
  computeDashboardKpis,
  computeDailySeries,
  computeLeadsPorOrigem,
  computeClientesPorOrigem,
  computeLeadsPorServico,
  computeClientesPorServico,
} from '@/services/dashboard'
import type { DashboardFilterInput as DashboardFilterInputType } from '@/services/dashboard'
import type { ServicoInteresse } from '@/types'

export const DASHBOARD_QUERY_KEYS = {
  root: ['dashboard'] as const,
  leads: (filter: DashboardFilterInputType) => {
    const normalized = toDashboardDateFilter(filter)
    if (normalized.type === 'preset') {
      return ['dashboard', 'leads', 'preset', normalized.preset] as const
    }
    return ['dashboard', 'leads', 'custom', normalized.from, normalized.to] as const
  },
  consultores: ['dashboard', 'consultores'] as const,
}

const STALE_MS = 30_000

export function useDashboardLeads(filter: DashboardFilterInputType) {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.leads(filter),
    queryFn: () => fetchDashboardLeads(filter),
    staleTime: STALE_MS,
  })
}

export function useDashboardKpis(
  filter: DashboardFilterInputType,
  planFilter: ServicoInteresse | 'all' = 'all',
) {
  const { data: leads = [], ...query } = useDashboardLeads(filter)
  const filteredLeads = useMemo(
    () => (planFilter === 'all' ? leads : leads.filter(l => l.servico_interesse === planFilter)),
    [leads, planFilter],
  )
  const kpis = useMemo(() => computeDashboardKpis(filteredLeads), [filteredLeads])
  return { kpis, leads: filteredLeads, ...query }
}

export function useDashboardCharts(
  filter: DashboardFilterInputType,
  planFilter: ServicoInteresse | 'all' = 'all',
) {
  const { data: leads = [], ...query } = useDashboardLeads(filter)
  const filteredLeads = useMemo(
    () => (planFilter === 'all' ? leads : leads.filter(l => l.servico_interesse === planFilter)),
    [leads, planFilter],
  )
  const charts = useMemo(
    () => ({
      daily: computeDailySeries(filteredLeads),
      origem: computeLeadsPorOrigem(filteredLeads),
      clientesOrigem: computeClientesPorOrigem(filteredLeads),
      servico: computeLeadsPorServico(filteredLeads),
      clientesServico: computeClientesPorServico(filteredLeads),
    }),
    [filteredLeads],
  )
  return { charts, leads: filteredLeads, ...query }
}

export function useConsultoresPerformanceTable(enabled: boolean) {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.consultores,
    queryFn: fetchConsultoresAtivos,
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/** Invalida caches do dashboard (KPIs após mutações em leads). */
export function invalidateDashboardQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.root })
}
