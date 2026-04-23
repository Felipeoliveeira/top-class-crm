import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchLeadsByStatus,
  fetchLeadsByStatusPaginated,
  fetchActiveConsultores,
  fetchAllPerfisNames,
  createLead,
  advanceStage,
  markAsLost,
  inactivateLead,
  PAGE_SIZE,
  type CreateLeadInput,
  type MarkAsLostInput,
  type LeadsCreatedAtRangeFilter,
} from '@/services/pipeline'
import { invalidateDashboardQueries } from '@/hooks/useDashboard'
import type { Lead, LeadStatus } from '@/types'

// ---------------------------------------------------------------------------
// Query keys centralizadas
// ---------------------------------------------------------------------------

export const PIPELINE_QUERY_KEYS = {
  leads: (filter?: LeadsCreatedAtRangeFilter) =>
    ['pipeline', 'leads', filter?.from ?? null, filter?.to ?? null] as const,
  consultores: ['pipeline', 'consultores'] as const,
  perfisNames: ['pipeline', 'perfisNames'] as const,
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePipelineLeads(filter?: LeadsCreatedAtRangeFilter) {
  return useQuery({
    queryKey: PIPELINE_QUERY_KEYS.leads(filter),
    queryFn: () => fetchLeadsByStatus(filter),
  })
}

export function useActiveConsultores() {
  return useQuery({
    queryKey: PIPELINE_QUERY_KEYS.consultores,
    queryFn: fetchActiveConsultores,
    staleTime: 5 * 60 * 1000,
  })
}

export function useAllPerfisNames() {
  return useQuery({
    queryKey: PIPELINE_QUERY_KEYS.perfisNames,
    queryFn: fetchAllPerfisNames,
    staleTime: 5 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLeadInput) => createLead(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'leads'] })
      invalidateDashboardQueries(queryClient)
    },
  })
}

export function useAdvanceStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ lead, targetStatus }: { lead: Lead; targetStatus: LeadStatus }) =>
      advanceStage(lead, targetStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'leads'] })
      invalidateDashboardQueries(queryClient)
    },
  })
}

export function useMarkAsLost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ lead, ...input }: { lead: Lead } & MarkAsLostInput) =>
      markAsLost(lead, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'leads'] })
      invalidateDashboardQueries(queryClient)
    },
  })
}

export function useInactivateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (lead: Lead) => inactivateLead(lead),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'leads'] })
      invalidateDashboardQueries(queryClient)
    },
  })
}

// ---------------------------------------------------------------------------
// Helpers derivados (computam dados a partir da query de leads)
// ---------------------------------------------------------------------------

/** Agrupa leads por status para renderizar colunas do Kanban */
export function groupLeadsByStatus(leads: Lead[]): Record<LeadStatus, Lead[]> {
  const grouped: Record<LeadStatus, Lead[]> = {
    atendimento: [],
    negociacao: [],
    fechado: [],
    perdido: [],
    inativo: [],
  }
  for (const lead of leads) {
    grouped[lead.status].push(lead)
  }
  return grouped
}

/** Constrói mapa id → nome_completo a partir da lista de consultores */
export function buildConsultorNameMap(
  consultores: { id: string; nome_completo: string }[],
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const c of consultores) {
    map[c.id] = c.nome_completo
  }
  return map
}

// ---------------------------------------------------------------------------
// Paginação por coluna
// ---------------------------------------------------------------------------

export interface ColumnLeadsState {
  leads: Lead[]
  total: number
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  loadMore: () => Promise<void>
}

/**
 * Gerencia paginação independente para uma coluna do kanban.
 * Carrega os primeiros PAGE_SIZE leads e acumula ao clicar em "Carregar mais".
 * Recomeça do início sempre que `status`, `filter` ou `resetKey` mudar.
 */
export function useColumnLeads(
  status: LeadStatus,
  filter?: LeadsCreatedAtRangeFilter,
  resetKey?: number,
): ColumnLeadsState {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Refs para evitar stale closures no loadMore
  const offsetRef = useRef(0)
  const isLoadingMoreRef = useRef(false)

  const filterFrom = filter?.from ?? null
  const filterTo = filter?.to ?? null

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLeads([])
    setTotal(0)
    offsetRef.current = 0

    const effectiveFilter: LeadsCreatedAtRangeFilter | undefined =
      filterFrom || filterTo ? { from: filterFrom, to: filterTo } : undefined

    fetchLeadsByStatusPaginated(status, 0, PAGE_SIZE, effectiveFilter)
      .then(({ data, count }) => {
        if (cancelled) return
        setLeads(data)
        setTotal(count)
        offsetRef.current = data.length
        setIsLoading(false)
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, filterFrom, filterTo, resetKey])

  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)

    const effectiveFilter: LeadsCreatedAtRangeFilter | undefined =
      filterFrom || filterTo ? { from: filterFrom, to: filterTo } : undefined

    try {
      const { data } = await fetchLeadsByStatusPaginated(
        status,
        offsetRef.current,
        PAGE_SIZE,
        effectiveFilter,
      )
      setLeads(prev => [...prev, ...data])
      offsetRef.current += data.length
    } catch (error) {
      console.error('Erro ao carregar mais leads da coluna', { status, error })
    } finally {
      isLoadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [status, filterFrom, filterTo])

  return {
    leads,
    total,
    hasMore: leads.length < total,
    isLoading,
    isLoadingMore,
    loadMore,
  }
}
