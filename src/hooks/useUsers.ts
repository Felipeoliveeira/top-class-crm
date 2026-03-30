import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchPerfisForAdmin,
  invokeInviteUser,
  invokeResendInvite,
  updatePerfilStatus,
  type InviteUserPayload,
} from '@/services/users'

export const USERS_QUERY_KEYS = {
  perfis: ['users', 'perfis'] as const,
}

export function usePerfisAdmin() {
  return useQuery({
    queryKey: USERS_QUERY_KEYS.perfis,
    queryFn: fetchPerfisForAdmin,
    staleTime: 30_000,
  })
}

export function useInviteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: InviteUserPayload) => invokeInviteUser(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEYS.perfis })
    },
  })
}

export function useResendInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => invokeResendInvite(email),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEYS.perfis })
    },
  })
}

export function useTogglePerfilStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ativo' | 'inativo' }) =>
      updatePerfilStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEYS.perfis })
    },
  })
}
