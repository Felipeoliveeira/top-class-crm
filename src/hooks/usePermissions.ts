import { useAuth } from './useAuth'

export function usePermissions() {
  const { isAdmin, isConsultor, user } = useAuth()

  return {
    canViewAllLeads: isAdmin,
    canAssignConsultor: isAdmin,
    canReassignLead: isAdmin,
    canExportCsv: isAdmin,
    canManageUsers: isAdmin,
    canViewPerformanceTable: isAdmin,
    canViewFinancialKpis: isAdmin,
    canViewAllDashboard: isAdmin,
    canInactivateLead: (consultorId: string) => isAdmin || (isConsultor && user?.id === consultorId),
    canMarkAsLost: (consultorId: string) => isAdmin || (isConsultor && user?.id === consultorId),
    canAddInteraction: (consultorId: string) => isAdmin || (isConsultor && user?.id === consultorId),
    canEditLead: true,
    isOwnLead: (consultorId: string) => user?.id === consultorId,
  }
}
