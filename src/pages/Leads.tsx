import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { usePipelineLeads, useActiveConsultores, useInactivateLead } from '@/hooks/usePipeline'
import { useLogExportacao } from '@/hooks/useLeads'
import { buildLeadsExportCsv, type LeadsListFiltersSnapshot } from '@/services/leads'
import {
  LEAD_STATUS_LABELS,
  LEAD_ORIGEM_LABELS,
  LEAD_NECESSIDADE_LABELS,
  type LeadStatus,
  type LeadOrigem,
} from '@/types'
import { Pencil, UserX, Download, Upload, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ImportarCsvModal } from '@/components/leads/ImportarCsvModal'

export default function LeadsPage() {
  const { user } = useAuth()
  const { canViewAllLeads, canExportCsv, canImportCsv, canInactivateLead } = usePermissions()
  const [importModalOpen, setImportModalOpen] = useState(false)
  const navigate = useNavigate()

  const { data: allLeads = [], isLoading: loading } = usePipelineLeads()
  const { data: consultores = [] } = useActiveConsultores()
  const inactivateMutation = useInactivateLead()
  const exportLogMutation = useLogExportacao()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [origemFilter, setOrigemFilter] = useState<LeadOrigem | 'all'>('all')
  const [page, setPage] = useState(1)
  const perPage = 25

  const consultorNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const consultor of consultores) {
      map[consultor.id] = consultor.nome_completo
    }
    return map
  }, [consultores])

  const filteredLeads = useMemo(() => {
    let data = [...allLeads]

    if (search.trim()) {
      const query = search.toLowerCase().trim()
      const queryDigits = query.replace(/\D/g, '')

      data = data.filter(lead => {
        if (lead.nome.toLowerCase().includes(query)) return true
        if ((lead.email ?? '').toLowerCase().includes(query)) return true
        if ((lead.razao_social ?? '').toLowerCase().includes(query)) return true

        if (queryDigits) {
          if (lead.telefone.replace(/\D/g, '').includes(queryDigits)) return true
          if ((lead.cnpj ?? '').replace(/\D/g, '').includes(queryDigits)) return true
          if ((lead.cpf ?? '').replace(/\D/g, '').includes(queryDigits)) return true
        }

        return false
      })
    }

    if (statusFilter !== 'all') data = data.filter(lead => lead.status === statusFilter)
    if (origemFilter !== 'all') data = data.filter(lead => lead.origem === origemFilter)

    return data
  }, [allLeads, search, statusFilter, origemFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / perPage))
  const safePage = Math.min(page, totalPages)
  const paginatedLeads = filteredLeads.slice((safePage - 1) * perPage, safePage * perPage)

  const getConsultorName = (consultorId: string) => consultorNames[consultorId] || 'N/A'

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setOrigemFilter('all')
    setPage(1)
  }

  const handleExportCsv = async () => {
    if (!user?.id) return
    try {
      const csv = buildLeadsExportCsv(filteredLeads)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`
      anchor.click()
      URL.revokeObjectURL(url)

      const filtros: LeadsListFiltersSnapshot = {
        search,
        status: statusFilter,
        origem: origemFilter,
        consultorId: 'all',
        periodoDe: null,
        periodoAte: null,
      }

      await exportLogMutation.mutateAsync({
        exportadoPor: user.id,
        totalRegistros: filteredLeads.length,
        filtros,
      })
      toast.success('CSV exportado com sucesso!')
    } catch (error) {
      toast.error(`Falha na exportação: ${(error as Error).message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leads"
        subtitle={`${filteredLeads.length} leads encontrados`}
        actions={
          (canExportCsv || canImportCsv) ? (
            <div className="hidden md:flex items-center gap-2">
              {canImportCsv && (
                <Button
                  onClick={() => setImportModalOpen(true)}
                  variant="outline"
                  className="border-border text-foreground hover:bg-surface-elevated"
                >
                  <Upload className="mr-2 h-4 w-4" /> Importar CSV
                </Button>
              )}
              {canExportCsv && (
                <Button
                  onClick={handleExportCsv}
                  variant="outline"
                  className="border-border text-foreground hover:bg-surface-elevated"
                  disabled={exportLogMutation.isPending}
                >
                  <Download className="mr-2 h-4 w-4" /> Exportar CSV
                </Button>
              )}
            </div>
          ) : null
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail, telefone, razão social, CNPJ ou CPF..."
            value={search}
            onChange={event => {
              setSearch(event.target.value)
              setPage(1)
            }}
            className="pl-10 bg-card border-border"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={value => {
            setStatusFilter(value as LeadStatus | 'all')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-40 bg-card border-border text-foreground">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all" className="text-foreground focus:bg-surface-elevated">
              Todos
            </SelectItem>
            {Object.entries(LEAD_STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key} className="text-foreground focus:bg-surface-elevated">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={origemFilter}
          onValueChange={value => {
            setOrigemFilter(value as LeadOrigem | 'all')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-40 bg-card border-border text-foreground">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all" className="text-foreground focus:bg-surface-elevated">
              Todas
            </SelectItem>
            {Object.entries(LEAD_ORIGEM_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key} className="text-foreground focus:bg-surface-elevated">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="button" variant="ghost" className="text-muted-foreground" onClick={resetFilters}>
          Limpar
        </Button>
      </div>

      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[920px]">
          <thead>
            <tr className="bg-card">
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Nome</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Telefone</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Origem</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Necessidade</th>
              {canViewAllLeads && (
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">
                  Consultor
                </th>
              )}
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Data</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLeads.map(lead => (
              <tr key={lead.id} className="border-t border-border hover:bg-card/80 transition-colors">
                <td className="py-3 px-4 text-sm font-medium text-foreground">{lead.nome}</td>
                <td className="py-3 px-4 text-sm text-muted-foreground">{lead.telefone}</td>
                <td className="py-3 px-4">
                  {lead.origem ? (
                    <StatusBadge status={lead.origem} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-sm text-muted-foreground">
                  {lead.necessidade ? LEAD_NECESSIDADE_LABELS[lead.necessidade] : '—'}
                </td>
                {canViewAllLeads && (
                  <td className="py-3 px-4 text-sm text-muted-foreground">{getConsultorName(lead.consultor_id)}</td>
                )}
                <td className="py-3 px-4 text-sm text-muted-foreground">
                  {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td className="py-3 px-4">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {lead.status === 'fechado' && canInactivateLead() && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={inactivateMutation.isPending}
                        onClick={async event => {
                          event.stopPropagation()
                          try {
                            await inactivateMutation.mutateAsync(lead)
                            toast.success('Cliente inativado com sucesso')
                          } catch (error) {
                            toast.error(`Erro ao inativar: ${(error as Error).message}`)
                          }
                        }}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {paginatedLeads.map(lead => (
          <div
            key={lead.id}
            className="rounded-lg bg-card border border-border p-4"
            onClick={() => navigate(`/leads/${lead.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={event => {
              if (event.key === 'Enter') navigate(`/leads/${lead.id}`)
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-foreground">{lead.nome}</p>
              <StatusBadge status={lead.status} />
            </div>
            <p className="text-xs text-muted-foreground">{lead.telefone}</p>
            <p className="text-xs text-muted-foreground">
              {lead.origem ? LEAD_ORIGEM_LABELS[lead.origem] : 'Sem origem'} {' • '}
              {new Date(lead.created_at).toLocaleDateString('pt-BR')}
            </p>
            {lead.necessidade && (
              <p className="text-xs text-muted-foreground">{LEAD_NECESSIDADE_LABELS[lead.necessidade]}</p>
            )}
            {canViewAllLeads && (
              <p className="text-xs text-muted-foreground">Consultor: {getConsultorName(lead.consultor_id)}</p>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Exibindo {(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, filteredLeads.length)} de{' '}
            {filteredLeads.length} leads
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={safePage <= 1}
              onClick={() => setPage(previous => previous - 1)}
              className="h-8 w-8 border-border text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-foreground">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={safePage >= totalPages}
              onClick={() => setPage(previous => previous + 1)}
              className="h-8 w-8 border-border text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {canImportCsv && (
        <ImportarCsvModal open={importModalOpen} onOpenChange={setImportModalOpen} />
      )}
    </div>
  )
}
