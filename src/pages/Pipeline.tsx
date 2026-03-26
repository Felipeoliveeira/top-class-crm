import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { PaymentPendingFlag } from '@/components/PaymentPendingFlag'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { mockLeads, mockPerfis } from '@/data/mockData'
import { LEAD_STATUS_LABELS, LEAD_ORIGEM_LABELS, LEAD_NECESSIDADE_LABELS, type Lead, type LeadStatus, type LeadOrigem, type LeadNecessidade } from '@/types'
import { Plus, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const statusColumns: { status: LeadStatus; color: string }[] = [
  { status: 'atendimento', color: 'border-l-warning' },
  { status: 'negociacao', color: 'border-l-orange-500' },
  { status: 'fechado', color: 'border-l-success' },
  { status: 'perdido', color: 'border-l-destructive' },
]

const headerColors: Record<LeadStatus, string> = {
  atendimento: 'text-warning',
  negociacao: 'text-orange-400',
  fechado: 'text-success',
  perdido: 'text-destructive',
  inativo: 'text-muted-foreground',
}

export default function PipelinePage() {
  const { user } = useAuth()
  const { canViewAllLeads, canAssignConsultor } = usePermissions()
  const [leads, setLeads] = useState<Lead[]>(mockLeads)
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [mobileFilter, setMobileFilter] = useState<LeadStatus>('atendimento')

  // New lead form
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [consultorId, setConsultorId] = useState('')

  const filteredLeads = useMemo(() => {
    if (canViewAllLeads) return leads
    return leads.filter(l => l.consultor_id === user?.id)
  }, [leads, canViewAllLeads, user?.id])

  const consultores = mockPerfis.filter(p => p.role === 'consultor' && p.status === 'ativo')
  const getConsultorName = (id: string) => mockPerfis.find(p => p.id === id)?.nome_completo || 'N/A'

  const canCreate = nome && telefone && (canAssignConsultor ? consultorId : true)

  const handleCreate = () => {
    // TODO: Substituir por insert Supabase — tabela: leads
    const newLead: Lead = {
      id: Date.now(),
      consultor_id: canAssignConsultor ? consultorId : (user?.id || ''),
      nome, telefone,
      origem: null,
      necessidade: null,
      status: 'atendimento',
      servico_interesse: null, valor_bruto: null, porcentagem_desconto: null, valor_liquido: null,
      email: null, rg: null, cpf: null, cnpj: null, razao_social: null, contato_numero: null,
      socios: null, status_financeiro: null, data_prevista_pagamento: null,
      motivo_perda_tipo: null, motivo_perda_descricao: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ultima_movimentacao_at: null,
    }
    setLeads(prev => [newLead, ...prev])
    setNewLeadOpen(false)
    setNome(''); setTelefone(''); setOrigem(''); setNecessidade(''); setConsultorId('')
    toast.success('Lead criado com sucesso!')
  }

  const moveLeadMobile = (lead: Lead, newStatus: LeadStatus) => {
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus, updated_at: new Date().toISOString() } : l))
    toast.success(`Lead movido para ${LEAD_STATUS_LABELS[newStatus]}`)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pipeline"
        actions={
          <Button onClick={() => setNewLeadOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Novo Lead
          </Button>
        }
      />

      {/* Desktop Kanban */}
      <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
        {statusColumns.map(({ status, color }) => {
          const columnLeads = filteredLeads.filter(l => l.status === status)
          return (
            <div key={status} className="w-80 shrink-0">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className={cn('text-sm font-bold uppercase tracking-wider', headerColors[status])}>
                  {LEAD_STATUS_LABELS[status]}
                </h3>
                <span className="rounded-full bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{columnLeads.length}</span>
              </div>
              <div className={cn('space-y-2 rounded-lg p-2 min-h-[200px]', status === 'perdido' ? 'opacity-70' : '')}>
                {columnLeads.map(lead => (
                  <a
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className={cn('block rounded-lg border-l-4 bg-card p-4 border border-border hover:bg-surface-elevated transition-all cursor-pointer', color)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-sm text-foreground">{lead.nome}</p>
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <StatusBadge status={lead.origem as 'ativo'} />
                    </div>
                    {lead.valor_liquido && lead.valor_liquido > 0 && (
                      <p className="text-sm font-bold text-primary">R$ {lead.valor_liquido.toLocaleString('pt-BR')}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{getConsultorName(lead.consultor_id)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</p>
                    {lead.status === 'negociacao' && lead.status_financeiro === 'pendente' && (
                      <div className="mt-2"><PaymentPendingFlag /></div>
                    )}
                    {lead.status === 'inativo' && (
                      <StatusBadge status="inativo" className="mt-2" />
                    )}
                  </a>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile list view */}
      <div className="md:hidden space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {statusColumns.map(({ status }) => (
            <button
              key={status}
              onClick={() => setMobileFilter(status)}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                mobileFilter === status ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'
              )}
            >
              {LEAD_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {filteredLeads.filter(l => l.status === mobileFilter).map(lead => (
            <div key={lead.id} className="rounded-lg bg-card border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">{lead.nome}</p>
                <StatusBadge status={lead.status} />
              </div>
              {lead.valor_liquido && <p className="text-sm font-bold text-primary">R$ {lead.valor_liquido.toLocaleString('pt-BR')}</p>}
              <p className="text-xs text-muted-foreground">{getConsultorName(lead.consultor_id)} • {new Date(lead.created_at).toLocaleDateString('pt-BR')}</p>
              {lead.status_financeiro === 'pendente' && <PaymentPendingFlag />}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1 border-border text-foreground" asChild>
                  <a href={`/leads/${lead.id}`}>Ver Detalhes</a>
                </Button>
                {(lead.status === 'atendimento' || lead.status === 'negociacao') && (
                  <>
                    <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => moveLeadMobile(lead, lead.status === 'atendimento' ? 'negociacao' : 'fechado')}>
                      Avançar
                    </Button>
                    <Button size="sm" variant="outline" className="border-destructive text-destructive" onClick={() => moveLeadMobile(lead, 'perdido')}>
                      Perdido
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Lead Modal */}
      <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">+ Novo Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-foreground">Nome *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do lead" className="bg-background border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Telefone *</Label>
              <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className="bg-background border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Origem *</Label>
              <Select value={origem} onValueChange={v => setOrigem(v as LeadOrigem)}>
                <SelectTrigger className="bg-background border-border text-foreground"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.entries(LEAD_ORIGEM_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-foreground focus:bg-surface-elevated">{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Necessidade *</Label>
              <Select value={necessidade} onValueChange={v => setNecessidade(v as LeadNecessidade)}>
                <SelectTrigger className="bg-background border-border text-foreground"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.entries(LEAD_NECESSIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-foreground focus:bg-surface-elevated">{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {canAssignConsultor && (
              <div className="space-y-2">
                <Label className="text-foreground">Consultor Responsável *</Label>
                <Select value={consultorId} onValueChange={setConsultorId}>
                  <SelectTrigger className="bg-background border-border text-foreground"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {consultores.map(c => <SelectItem key={c.id} value={c.id} className="text-foreground focus:bg-surface-elevated">{c.nome_completo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLeadOpen(false)} className="border-border text-foreground">Cancelar</Button>
            <Button onClick={handleCreate} disabled={!canCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">Criar Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
