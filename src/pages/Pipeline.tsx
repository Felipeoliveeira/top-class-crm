import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { PaymentPendingFlag } from '@/components/PaymentPendingFlag'
import { ImportedIncompleteFlag } from '@/components/ImportedIncompleteFlag'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import {
  useColumnLeads,
  useActiveConsultores,
  useAllPerfisNames,
  useCreateLead,
  useAdvanceStage,
  useMarkAsLost,
  type ColumnLeadsState,
} from '@/hooks/usePipeline'
import {
  isTransitionAllowed,
  GateValidationError,
  TransitionNotAllowedError,
} from '@/services/pipeline'
import {
  LEAD_STATUS_LABELS,
  MOTIVO_PERDA_LABELS,
  type Lead,
  type LeadStatus,
  type MotivoPerdaTipo,
} from '@/types'
import { Plus, GripVertical, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatTelefoneBrMobile, telefoneBrMobileSchema } from '@/lib/br-inputs'
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Retorna true quando um lead importado via CSV está em Fechado com dados obrigatórios ausentes. */
function hasImportedIncompleteData(lead: Lead): boolean {
  const semTelefone = !lead.telefone?.trim()
  return (
    lead.importado_csv &&
    lead.status === 'fechado' &&
    (semTelefone || !lead.cpf || !lead.rg || lead.possui_nota_fiscal === null)
  )
}

// ---------------------------------------------------------------------------
// Constantes visuais
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Validação zod — criação de lead (S-3.2.1)
// ---------------------------------------------------------------------------

const createLeadSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  telefone: telefoneBrMobileSchema,
})

// ---------------------------------------------------------------------------
// Sub-componentes do Kanban
// ---------------------------------------------------------------------------

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
      {hasImportedIncompleteData(lead) && (
        <div className="mt-2"><ImportedIncompleteFlag /></div>
      )}
      {lead.status === 'inativo' && (
        <StatusBadge status="inativo" className="mt-2" />
      )}
    </div>
  )
}

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

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function PipelinePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { canAssignConsultor } = usePermissions()

  // Chave de reset: incrementar força todos os hooks de coluna a recarregar do início
  const [paginationReset, setPaginationReset] = useState(0)
  const resetAllColumns = useCallback(() => setPaginationReset(k => k + 1), [])

  // Uma instância de paginação por coluna (hooks não podem ser chamados em loops)
  const atendimentoCol = useColumnLeads('atendimento', undefined, paginationReset)
  const negociacaoCol  = useColumnLeads('negociacao',  undefined, paginationReset)
  const fechadoCol     = useColumnLeads('fechado',     undefined, paginationReset)
  const perdidoCol     = useColumnLeads('perdido',     undefined, paginationReset)

  const columnMap: Record<LeadStatus, ColumnLeadsState> = {
    atendimento: atendimentoCol,
    negociacao:  negociacaoCol,
    fechado:     fechadoCol,
    perdido:     perdidoCol,
    // 'inativo' não aparece no kanban — valor vazio para satisfazer o tipo
    inativo: { leads: [], total: 0, hasMore: false, isLoading: false, isLoadingMore: false, loadMore: async () => {} },
  }

  // Array unificado usado pelo DnD para localizar leads pelo id
  const allLeads = [
    ...atendimentoCol.leads,
    ...negociacaoCol.leads,
    ...fechadoCol.leads,
    ...perdidoCol.leads,
  ]

  const isLoading =
    atendimentoCol.isLoading ||
    negociacaoCol.isLoading  ||
    fechadoCol.isLoading     ||
    perdidoCol.isLoading

  const { data: consultores = [] } = useActiveConsultores()
  const { data: perfisNames = {} } = useAllPerfisNames()
  const createLeadMutation = useCreateLead()
  const advanceStageMutation = useAdvanceStage()
  const markAsLostMutation = useMarkAsLost()

  // Estado de UI
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [mobileFilter, setMobileFilter] = useState<LeadStatus>('atendimento')
  const [activeDragLead, setActiveDragLead] = useState<Lead | null>(null)

  // Modal de perda
  const [lossModalOpen, setLossModalOpen] = useState(false)
  const [lossLead, setLossLead] = useState<Lead | null>(null)
  const [lossMotivo, setLossMotivo] = useState<MotivoPerdaTipo | ''>('')
  const [lossDescricao, setLossDescricao] = useState('')

  // Form novo lead
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [consultorId, setConsultorId] = useState('')

  const getConsultorName = (id: string) => perfisNames[id] || 'N/A'

  // --- Criação de lead com zod (S-3.2.1) ---
  const handleCreate = async () => {
    const parsed = createLeadSchema.safeParse({ nome, telefone })
    if (!parsed.success) {
      toast.error(parsed.error.errors.map(e => e.message).join(', '))
      return
    }

    const consultorIdFinal = canAssignConsultor ? consultorId : (user?.id || '')
    if (canAssignConsultor && !consultorId) {
      toast.error('Selecione um consultor responsável')
      return
    }

    try {
      await createLeadMutation.mutateAsync({
        nome: parsed.data.nome,
        telefone: parsed.data.telefone,
        consultor_id: consultorIdFinal,
      })
      setNewLeadOpen(false)
      setNome(''); setTelefone(''); setConsultorId('')
      toast.success('Lead criado com sucesso!')
      resetAllColumns()
    } catch (err) {
      toast.error(`Erro ao criar lead: ${(err as Error).message}`)
    }
  }

  // --- Drag and Drop ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const lead = (event.active.data.current as { lead: Lead })?.lead
    if (lead) setActiveDragLead(lead)
  }

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragLead(null)
    const { active, over } = event
    if (!over) return

    const lead = (active.data.current as { lead: Lead })?.lead
    if (!lead) return

    const overId = String(over.id)
    let targetStatus: LeadStatus | null = null
    if (overId.startsWith('column-')) {
      targetStatus = overId.replace('column-', '') as LeadStatus
    } else if (overId.startsWith('lead-')) {
      const targetLeadId = Number(overId.replace('lead-', ''))
      const targetLead = allLeads.find(l => l.id === targetLeadId)
      targetStatus = targetLead?.status || null
    }

    if (!targetStatus || targetStatus === lead.status) return

    if (!isTransitionAllowed(lead.status, targetStatus)) {
      toast.error('Esta movimentação não é permitida.')
      return
    }

    if (targetStatus === 'perdido') {
      setLossLead(lead)
      setLossMotivo('')
      setLossDescricao('')
      setLossModalOpen(true)
      return
    }

    try {
      await advanceStageMutation.mutateAsync({ lead, targetStatus })
      toast.success(`Lead movido para ${LEAD_STATUS_LABELS[targetStatus]}`)
      resetAllColumns()
    } catch (err) {
      if (err instanceof GateValidationError) {
        toast.error(`Preencha os campos obrigatórios no detalhe do lead para avançar: ${err.missingFields.join(', ')}`)
      } else if (err instanceof TransitionNotAllowedError) {
        toast.error('Esta movimentação não é permitida.')
      } else {
        toast.error(`Erro ao mover lead: ${(err as Error).message}`)
      }
    }
  }, [allLeads, advanceStageMutation, resetAllColumns])

  // --- Confirmar perda com validação de origem (S-3.3.5) ---
  const handleConfirmLoss = async () => {
    if (!lossMotivo || !lossLead) return
    if (lossMotivo === 'outro' && !lossDescricao.trim()) return

    if (!isTransitionAllowed(lossLead.status, 'perdido')) {
      toast.error('Esta movimentação não é permitida.')
      setLossModalOpen(false)
      return
    }

    try {
      await markAsLostMutation.mutateAsync({
        lead: lossLead,
        motivo_perda_tipo: lossMotivo as MotivoPerdaTipo,
        motivo_perda_descricao: lossMotivo === 'outro' ? lossDescricao : null,
      })
      setLossModalOpen(false)
      setLossLead(null)
      toast.success(`Lead movido para ${LEAD_STATUS_LABELS.perdido}`)
      resetAllColumns()
    } catch (err) {
      toast.error(`Erro ao atualizar lead: ${(err as Error).message}`)
      setLossModalOpen(false)
    }
  }

  // --- Ações mobile ---
  const moveLeadMobile = async (lead: Lead, newStatus: LeadStatus) => {
    if (!isTransitionAllowed(lead.status, newStatus)) {
      toast.error('Esta movimentação não é permitida.')
      return
    }

    if (newStatus === 'perdido') {
      setLossLead(lead)
      setLossMotivo('')
      setLossDescricao('')
      setLossModalOpen(true)
      return
    }

    try {
      await advanceStageMutation.mutateAsync({ lead, targetStatus: newStatus })
      toast.success(`Lead movido para ${LEAD_STATUS_LABELS[newStatus]}`)
      resetAllColumns()
    } catch (err) {
      if (err instanceof GateValidationError) {
        toast.error(`Preencha os campos obrigatórios: ${err.missingFields.join(', ')}`)
      } else {
        toast.error(`Erro ao mover lead: ${(err as Error).message}`)
      }
    }
  }

  const getCardColor = (status: LeadStatus) => statusColumns.find(c => c.status === status)?.color || ''

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
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

      {/* Desktop Kanban with DnD */}
      <div className="hidden md:block">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {statusColumns.map(({ status, color }) => {
              const colData = columnMap[status]
              return (
                <div key={status} className="flex-1 min-w-[280px] flex flex-col">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className={cn('text-sm font-bold uppercase tracking-wider', headerColors[status])}>
                      {LEAD_STATUS_LABELS[status]}
                    </h3>
                    <span className="rounded-full bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {colData.total}
                    </span>
                  </div>
                  <DroppableColumn status={status}>
                    {colData.leads.map(lead => (
                      <DraggableLeadCard
                        key={lead.id}
                        lead={lead}
                        color={color}
                        getConsultorName={getConsultorName}
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      />
                    ))}
                  </DroppableColumn>
                  {colData.hasMore && (
                    <button
                      onClick={() => colData.loadMore()}
                      disabled={colData.isLoadingMore}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-xs text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {colData.isLoadingMore
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : null}
                      Carregar mais
                    </button>
                  )}
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
          {columnMap[mobileFilter].leads.map(lead => (
            <div key={lead.id} className="rounded-lg bg-card border border-border p-4 space-y-2">
              <div className="flex items-center justify-between" onClick={() => navigate(`/leads/${lead.id}`)} role="button">
                <p className="font-semibold text-foreground">{lead.nome}</p>
                <StatusBadge status={lead.status} />
              </div>
              {lead.valor_liquido && <p className="text-sm font-bold text-primary">R$ {lead.valor_liquido.toLocaleString('pt-BR')}</p>}
              <p className="text-xs text-muted-foreground">{getConsultorName(lead.consultor_id)} • {new Date(lead.created_at).toLocaleDateString('pt-BR')}</p>
              {lead.status_financeiro === 'pendente' && <PaymentPendingFlag />}
              {hasImportedIncompleteData(lead) && <ImportedIncompleteFlag />}
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
          {columnMap[mobileFilter].hasMore && (
            <button
              onClick={() => columnMap[mobileFilter].loadMore()}
              disabled={columnMap[mobileFilter].isLoadingMore}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-3 text-xs text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground disabled:opacity-60"
            >
              {columnMap[mobileFilter].isLoadingMore
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : null}
              Carregar mais
            </button>
          )}
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
              <Input
                value={telefone}
                onChange={e => setTelefone(formatTelefoneBrMobile(e.target.value))}
                placeholder="(00) 00000-0000"
                inputMode="numeric"
                autoComplete="tel"
                className="bg-background border-border"
              />
            </div>
            {canAssignConsultor && (
              <div className="space-y-2">
                <Label className="text-foreground">Responsável *</Label>
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
            <Button onClick={handleCreate} disabled={createLeadMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {createLeadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loss Reason Modal */}
      <Dialog open={lossModalOpen} onOpenChange={(open) => {
        if (!open) {
          setLossModalOpen(false)
          setLossLead(null)
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
            <Button variant="outline" onClick={() => { setLossModalOpen(false); setLossLead(null) }} className="border-border text-foreground">Cancelar</Button>
            <Button
              onClick={handleConfirmLoss}
              disabled={!lossMotivo || (lossMotivo === 'outro' && !lossDescricao.trim()) || markAsLostMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {markAsLostMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
