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

export const DASHBOARD_QUERY_KEYS = {
  root: ['dashboard'] as const,
  leads: (filter: DashboardFilterInput) => {
    const normalized = toDashboardDateFilter(filter)
    if (normalized.type === 'preset') {
      return ['dashboard', 'leads', 'preset', normalized.preset] as const
    }
    return ['dashboard', 'leads', 'custom', normalized.from, normalized.to] as const
  },
  consultores: ['dashboard', 'consultores'] as const,
}

const STALE_MS = 30_000

export function useDashboardLeads(filter: DashboardFilterInput) {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.leads(filter),
    queryFn: () => fetchDashboardLeads(filter),
    staleTime: STALE_MS,
  })
}

export function useDashboardKpis(filter: DashboardFilterInput) {
  const { data: leads = [], ...query } = useDashboardLeads(filter)
  const kpis = useMemo(() => computeDashboardKpis(leads), [leads])
  return { kpis, leads, ...query }
}

export function useDashboardCharts(filter: DashboardFilterInput) {
  const { data: leads = [], ...query } = useDashboardLeads(filter)
  const charts = useMemo(
    () => ({
      daily: computeDailySeries(leads),
      origem: computeLeadsPorOrigem(leads),
      clientesOrigem: computeClientesPorOrigem(leads),
      servico: computeLeadsPorServico(leads),
      clientesServico: computeClientesPorServico(leads),
    }),
    [leads],
  )
  return { charts, leads, ...query }
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
