import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchLeadsByStatus,
  fetchActiveConsultores,
  fetchAllPerfisNames,
  createLead,
  advanceStage,
  markAsLost,
  inactivateLead,
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
