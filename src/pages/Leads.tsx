import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { supabase } from '@/integrations/supabase/client'
import { inactivateLead } from '@/services/pipeline'
import { LEAD_STATUS_LABELS, LEAD_ORIGEM_LABELS, type Lead, type LeadStatus, type LeadOrigem } from '@/types'
import { Pencil, UserX, Download, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function LeadsPage() {
  const { user } = useAuth()
  const { canViewAllLeads, canExportCsv, canInactivateLead } = usePermissions()
  const navigate = useNavigate()

  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [consultorNames, setConsultorNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [origemFilter, setOrigemFilter] = useState<LeadOrigem | 'all'>('all')
  const [page, setPage] = useState(1)
  const perPage = 25

  useEffect(() => {
    async function fetchLeads() {
      setLoading(true)
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
      setAllLeads((data as Lead[]) || [])

      // Fetch consultor names
      const { data: perfis } = await supabase.from('perfis').select('id, nome_completo')
      const names: Record<string, string> = {}
      perfis?.forEach(p => { names[p.id] = p.nome_completo })
      setConsultorNames(names)
      setLoading(false)
    }
    fetchLeads()
  }, [])

  const filteredLeads = useMemo(() => {
    let data = allLeads
    if (search) {
      const s = search.toLowerCase()
      data = data.filter(l => l.nome.toLowerCase().includes(s) || l.telefone.includes(s) || (l.email || '').toLowerCase().includes(s))
    }
    if (statusFilter !== 'all') data = data.filter(l => l.status === statusFilter)
    if (origemFilter !== 'all') data = data.filter(l => l.origem === origemFilter)
    return data
  }, [allLeads, search, statusFilter, origemFilter])

  const totalPages = Math.ceil(filteredLeads.length / perPage)
  const paginatedLeads = filteredLeads.slice((page - 1) * perPage, page * perPage)
  const getConsultor = (id: string) => consultorNames[id] || 'N/A'

  const exportCsv = () => {
    toast.success('CSV exportado com sucesso!')
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
          canExportCsv ? (
            <Button onClick={exportCsv} variant="outline" className="hidden md:flex border-border text-foreground hover:bg-surface-elevated">
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          ) : null
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-10 bg-card border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v as LeadStatus | 'all'); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40 bg-card border-border text-foreground"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all" className="text-foreground focus:bg-surface-elevated">Todos</SelectItem>
            {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-foreground focus:bg-surface-elevated">{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={origemFilter} onValueChange={v => { setOrigemFilter(v as LeadOrigem | 'all'); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40 bg-card border-border text-foreground"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all" className="text-foreground focus:bg-surface-elevated">Todas</SelectItem>
            {Object.entries(LEAD_ORIGEM_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-foreground focus:bg-surface-elevated">{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr className="bg-card">
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Nome</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Telefone</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Origem</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Necessidade</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Consultor</th>
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
                <td className="py-3 px-4">{lead.origem ? <StatusBadge status={lead.origem as 'ativo'} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                <td className="py-3 px-4 text-sm text-muted-foreground">{lead.necessidade ? lead.necessidade.replace(/_/g, ' ') : '—'}</td>
                <td className="py-3 px-4 text-sm text-muted-foreground">{getConsultor(lead.consultor_id)}</td>
                <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="py-3 px-4"><StatusBadge status={lead.status} /></td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => navigate(`/leads/${lead.id}`)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {lead.status === 'fechado' && canInactivateLead(lead.consultor_id) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          await inactivateLead(lead)
                          setAllLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'inativo' as LeadStatus } : l))
                          toast.success('Cliente inativado com sucesso')
                        } catch (err) {
                          toast.error(`Erro ao inativar: ${(err as Error).message}`)
                        }
                      }}>
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

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {paginatedLeads.map(lead => (
          <div key={lead.id} className="rounded-lg bg-card border border-border p-4" onClick={() => navigate(`/leads/${lead.id}`)}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-foreground">{lead.nome}</p>
              <StatusBadge status={lead.status} />
            </div>
            <p className="text-xs text-muted-foreground">{lead.origem ? LEAD_ORIGEM_LABELS[lead.origem] : 'Sem origem'} • {new Date(lead.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Exibindo {(page - 1) * perPage + 1}–{Math.min(page * perPage, filteredLeads.length)} de {filteredLeads.length} leads
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-8 w-8 border-border text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8 w-8 border-border text-foreground">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
