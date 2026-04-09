import { useAuth } from './useAuth'

export function usePermissions() {
  const { isAdmin, isConsultor, user } = useAuth()

  const isAuthenticated = isAdmin || isConsultor

  return {
    // Todos os usuários autenticados veem e operam todos os leads (PRD RF-02, US-31)
    canViewAllLeads: isAuthenticated,
    canAssignConsultor: isAdmin,
    canReassignLead: isAdmin,
    canExportCsv: isAdmin,
    canImportCsv: isAdmin,
    canManageUsers: isAdmin,
    // Dashboard: tabela de performance e KPIs financeiros em R$ exclusivos do Admin
    canViewPerformanceTable: isAdmin,
    canViewFinancialKpis: isAdmin,
    // Ambos os perfis veem todos os leads no dashboard (sem restrição por consultor_id)
    canViewAllDashboard: isAuthenticated,
    canDeleteLead: isAdmin,
    // Qualquer usuário autenticado pode inativar, marcar como perdido e adicionar interações em qualquer lead
    canInactivateLead: () => isAuthenticated,
    canMarkAsLost: () => isAuthenticated,
    canAddInteraction: () => isAuthenticated,
    canEditLead: true,
    isOwnLead: (consultorId: string) => user?.id === consultorId,
  }
}
