import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { PaymentPendingFlag } from '@/components/PaymentPendingFlag'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { mockLeads, mockPerfis, mockDocumentos } from '@/data/mockData'
import { LEAD_STATUS_LABELS, MOTIVO_PERDA_LABELS, type Lead, type LeadStatus, type MotivoPerdaTipo } from '@/types'
import { Plus, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

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

// --- Draggable Card ---
function DraggableLeadCard({ lead, color, getConsultorName, onClick }: {
  lead: Lead; color: string; getConsultorName: (id: string) => string; onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `lead-${lead.id}`,
    data: { lead },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('rounded-lg border-l-4 bg-card p-4 border border-border hover:bg-surface-elevated transition-all cursor-pointer', color)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="font-semibold text-sm text-foreground">{lead.nome}</p>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {lead.origem && <StatusBadge status={lead.origem} />}
      </div>
      {lead.valor_liquido != null && lead.valor_liquido > 0 && (
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
    </div>
  )
}

// --- Droppable Column ---
function DroppableColumn({ status, children }: { status: LeadStatus; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'space-y-2 rounded-lg p-2 min-h-[200px] transition-colors',
        status === 'perdido' ? 'opacity-70' : '',
        isOver ? 'bg-surface-elevated/50 ring-1 ring-primary/30' : ''
      )}
    >
      {children}
    </div>
  )
}

// --- Overlay Card (shown while dragging) ---
function OverlayCard({ lead, color, getConsultorName }: { lead: Lead; color: string; getConsultorName: (id: string) => string }) {
  return (
    <div className={cn('rounded-lg border-l-4 bg-card p-4 border border-border shadow-xl w-80', color)}>
      <p className="font-semibold text-sm text-foreground">{lead.nome}</p>
      {lead.valor_liquido != null && lead.valor_liquido > 0 && (
        <p className="text-sm font-bold text-primary mt-1">R$ {lead.valor_liquido.toLocaleString('pt-BR')}</p>
      )}
      <p className="text-xs text-muted-foreground mt-1">{getConsultorName(lead.consultor_id)}</p>
    </div>
  )
}

// --- Validation helpers ---
function validateAtendimentoToNegociacao(lead: Lead): string[] {
  const missing: string[] = []
  if (!lead.origem) missing.push('Origem')
  if (!lead.necessidade) missing.push('Necessidade Identificada')
  return missing
}

function validateNegociacaoToFechado(lead: Lead): string[] {
  const missing: string[] = []
  if (!lead.servico_interesse) missing.push('Serviço de Interesse')
  if (!lead.valor_bruto) missing.push('Valor Bruto')
  if (!lead.email) missing.push('E-mail')
  if (!lead.rg) missing.push('RG')
  if (!lead.cpf) missing.push('CPF')
  if (lead.cnpj && !lead.razao_social) missing.push('Razão Social (PJ)')
  const docs = mockDocumentos.filter(d => d.lead_id === lead.id)
  if (docs.length === 0) missing.push('Ao menos 1 documento enviado')
  if (lead.status_financeiro !== 'pago') missing.push('Status Financeiro = Pago')
  return missing
}

export default function PipelinePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { canViewAllLeads, canAssignConsultor } = usePermissions()
  const [leads, setLeads] = useState<Lead[]>(mockLeads)
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [mobileFilter, setMobileFilter] = useState<LeadStatus>('atendimento')
  const [activeDragLead, setActiveDragLead] = useState<Lead | null>(null)

  // Loss modal state
  const [lossModalOpen, setLossModalOpen] = useState(false)
  const [lossLeadId, setLossLeadId] = useState<number | null>(null)
  const [lossOriginalStatus, setLossOriginalStatus] = useState<LeadStatus | null>(null)
  const [lossMotivo, setLossMotivo] = useState<MotivoPerdaTipo | ''>('')
  const [lossDescricao, setLossDescricao] = useState('')

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
    const newLead: Lead = {
      id: Date.now(),
      consultor_id: canAssignConsultor ? consultorId : (user?.id || ''),
      nome, telefone,
      origem: null, necessidade: null,
      status: 'atendimento',
      servico_interesse: null, valor_bruto: null, porcentagem_desconto: null, valor_liquido: null,
      email: null, rg: null, cpf: null, cnpj: null, razao_social: null, contato_numero: null,
      socios: null, status_financeiro: null, data_prevista_pagamento: null,
      motivo_perda_tipo: null, motivo_perda_descricao: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ultima_movimentacao_at: null,
    }
    setLeads(prev => [newLead, ...prev])
    setNewLeadOpen(false)
    setNome(''); setTelefone(''); setConsultorId('')
    toast.success('Lead criado com sucesso!')
  }

  // --- Drag and drop ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const lead = (event.active.data.current as { lead: Lead })?.lead
    if (lead) setActiveDragLead(lead)
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragLead(null)
    const { active, over } = event
    if (!over) return

    const lead = (active.data.current as { lead: Lead })?.lead
    if (!lead) return

    // Determine target column
    const overId = String(over.id)
    let targetStatus: LeadStatus | null = null
    if (overId.startsWith('column-')) {
      targetStatus = overId.replace('column-', '') as LeadStatus
    } else if (overId.startsWith('lead-')) {
      // Dropped on another card — find that card's status
      const targetLeadId = Number(overId.replace('lead-', ''))
      const targetLead = leads.find(l => l.id === targetLeadId)
      targetStatus = targetLead?.status || null
    }

    if (!targetStatus || targetStatus === lead.status) return

    // Invalid retroactive moves
    if (lead.status === 'fechado' && (targetStatus === 'atendimento' || targetStatus === 'negociacao')) {
      toast.error('Esta movimentação não é permitida.')
      return
    }
    if (lead.status === 'perdido') {
      toast.error('Esta movimentação não é permitida.')
      return
    }

    // Move to Perdido → open loss modal
    if (targetStatus === 'perdido') {
      setLossLeadId(lead.id)
      setLossOriginalStatus(lead.status)
      setLossMotivo('')
      setLossDescricao('')
      setLossModalOpen(true)
      return
    }

    // Atendimento → Negociação
    if (lead.status === 'atendimento' && targetStatus === 'negociacao') {
      const missing = validateAtendimentoToNegociacao(lead)
      if (missing.length > 0) {
        toast.error(`Preencha os campos obrigatórios no detalhe do lead para avançar: ${missing.join(', ')}`)
        return
      }
    }

    // Negociação → Fechado
    if (lead.status === 'negociacao' && targetStatus === 'fechado') {
      const missing = validateNegociacaoToFechado(lead)
      if (missing.length > 0) {
        toast.error(`Preencha os campos obrigatórios no detalhe do lead para avançar: ${missing.join(', ')}`)
        return
      }
    }

    // Atendimento → Fechado (skip negociacao — validate both)
    if (lead.status === 'atendimento' && targetStatus === 'fechado') {
      const missing1 = validateAtendimentoToNegociacao(lead)
      const missing2 = validateNegociacaoToFechado(lead)
      const allMissing = [...missing1, ...missing2]
      if (allMissing.length > 0) {
        toast.error(`Preencha os campos obrigatórios no detalhe do lead para avançar: ${allMissing.join(', ')}`)
        return
      }
    }

    // Valid move
    setLeads(prev => prev.map(l => l.id === lead.id
      ? { ...l, status: targetStatus!, updated_at: new Date().toISOString(), ultima_movimentacao_at: new Date().toISOString() }
      : l
    ))
    toast.success(`Lead movido para ${LEAD_STATUS_LABELS[targetStatus]}`)
  }, [leads])

  const handleConfirmLoss = () => {
    if (!lossMotivo) return
    if (lossMotivo === 'outro' && !lossDescricao.trim()) return

    setLeads(prev => prev.map(l => l.id === lossLeadId
      ? {
          ...l,
          status: 'perdido' as LeadStatus,
          motivo_perda_tipo: lossMotivo as MotivoPerdaTipo,
          motivo_perda_descricao: lossMotivo === 'outro' ? lossDescricao : null,
          updated_at: new Date().toISOString(),
          ultima_movimentacao_at: new Date().toISOString(),
        }
      : l
    ))
    setLossModalOpen(false)
    setLossLeadId(null)
    toast.success(`Lead movido para ${LEAD_STATUS_LABELS.perdido}`)
  }

  const moveLeadMobile = (lead: Lead, newStatus: LeadStatus) => {
    if (newStatus === 'perdido') {
      setLossLeadId(lead.id)
      setLossOriginalStatus(lead.status)
      setLossMotivo('')
      setLossDescricao('')
      setLossModalOpen(true)
      return
    }

    if (lead.status === 'atendimento' && newStatus === 'negociacao') {
      const missing = validateAtendimentoToNegociacao(lead)
      if (missing.length > 0) {
        toast.error(`Preencha os campos obrigatórios: ${missing.join(', ')}`)
        return
      }
    }
    if (lead.status === 'negociacao' && newStatus === 'fechado') {
      const missing = validateNegociacaoToFechado(lead)
      if (missing.length > 0) {
        toast.error(`Preencha os campos obrigatórios: ${missing.join(', ')}`)
        return
      }
    }

    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus, updated_at: new Date().toISOString() } : l))
    toast.success(`Lead movido para ${LEAD_STATUS_LABELS[newStatus]}`)
  }

  const getCardColor = (status: LeadStatus) => statusColumns.find(c => c.status === status)?.color || ''

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

      {/* Desktop Kanban with DnD */}
      <div className="hidden md:block">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {statusColumns.map(({ status, color }) => {
              const columnLeads = filteredLeads.filter(l => l.status === status)
              return (
                <div key={status} className="flex-1 min-w-[280px]">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className={cn('text-sm font-bold uppercase tracking-wider', headerColors[status])}>
                      {LEAD_STATUS_LABELS[status]}
                    </h3>
                    <span className="rounded-full bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{columnLeads.length}</span>
                  </div>
                  <DroppableColumn status={status}>
                    {columnLeads.map(lead => (
                      <DraggableLeadCard
                        key={lead.id}
                        lead={lead}
                        color={color}
                        getConsultorName={getConsultorName}
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      />
                    ))}
                  </DroppableColumn>
                </div>
              )
            })}
          </div>
          <DragOverlay>
            {activeDragLead ? (
              <OverlayCard lead={activeDragLead} color={getCardColor(activeDragLead.status)} getConsultorName={getConsultorName} />
            ) : null}
          </DragOverlay>
        </DndContext>
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
              <div className="flex items-center justify-between" onClick={() => navigate(`/leads/${lead.id}`)} role="button">
                <p className="font-semibold text-foreground">{lead.nome}</p>
                <StatusBadge status={lead.status} />
              </div>
              {lead.valor_liquido && <p className="text-sm font-bold text-primary">R$ {lead.valor_liquido.toLocaleString('pt-BR')}</p>}
              <p className="text-xs text-muted-foreground">{getConsultorName(lead.consultor_id)} • {new Date(lead.created_at).toLocaleDateString('pt-BR')}</p>
              {lead.status_financeiro === 'pendente' && <PaymentPendingFlag />}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1 border-border text-foreground" onClick={() => navigate(`/leads/${lead.id}`)}>
                  Ver Detalhes
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

      {/* Loss Reason Modal */}
      <Dialog open={lossModalOpen} onOpenChange={(open) => {
        if (!open) {
          setLossModalOpen(false)
          setLossLeadId(null)
        }
      }}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Marcar como Perdido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-foreground">Motivo da perda *</Label>
              <RadioGroup value={lossMotivo} onValueChange={(v) => setLossMotivo(v as MotivoPerdaTipo)}>
                {Object.entries(MOTIVO_PERDA_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <RadioGroupItem value={key} id={`loss-${key}`} />
                    <Label htmlFor={`loss-${key}`} className="text-foreground cursor-pointer">{label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            {lossMotivo === 'outro' && (
              <div className="space-y-2">
                <Label className="text-foreground">Descreva o motivo *</Label>
                <Textarea
                  value={lossDescricao}
                  onChange={e => setLossDescricao(e.target.value)}
                  placeholder="Descreva o motivo da perda..."
                  className="bg-background border-border"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLossModalOpen(false); setLossLeadId(null) }} className="border-border text-foreground">Cancelar</Button>
            <Button
              onClick={handleConfirmLoss}
              disabled={!lossMotivo || (lossMotivo === 'outro' && !lossDescricao.trim())}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
