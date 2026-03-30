import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDocumentCountsByLeadIds, logExportacao, reassignLeadConsultor, type LeadsListFiltersSnapshot } from '@/services/leads'
import { PIPELINE_QUERY_KEYS } from '@/hooks/usePipeline'
import type { Lead } from '@/types'

export const LEADS_QUERY_KEYS = {
  documentCounts: (leadIds: number[]) => ['leads', 'documentCounts', leadIds.sort((a, b) => a - b)] as const,
}

export function useDocumentCounts(leadIds: number[]) {
  return useQuery({
    queryKey: LEADS_QUERY_KEYS.documentCounts(leadIds),
    queryFn: () => fetchDocumentCountsByLeadIds(leadIds),
    enabled: leadIds.length > 0,
  })
}

export function useReassignLeadConsultor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId, novoConsultorId }: { leadId: number; novoConsultorId: string }) =>
      reassignLeadConsultor(leadId, novoConsultorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEYS.leads })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useLogExportacao() {
  return useMutation({
    mutationFn: (params: { exportadoPor: string; totalRegistros: number; filtros: LeadsListFiltersSnapshot }) =>
      logExportacao(params),
  })
}
