import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { BlockingModal } from '@/components/BlockingModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FileUpload } from '@/components/FileUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { supabase } from '@/integrations/supabase/client'
import { calculateValorLiquido, inactivateLead as inactivateLeadService } from '@/services/pipeline'
import {
  LEAD_ORIGEM_LABELS, LEAD_NECESSIDADE_LABELS, SERVICO_LABELS, MOTIVO_PERDA_LABELS,
  type Lead, type LeadOrigem, type LeadNecessidade, type ServicoInteresse, type MotivoPerdaTipo, type StatusFinanceiro,
  type HistoricoInteracao, type DocumentoLead, type Perfil
} from '@/types'
import { ChevronDown, Save, ArrowRight, XCircle, UserX, Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function LeadDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canAssignConsultor, canInactivateLead, canMarkAsLost, canAddInteraction } = usePermissions()

  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [blockingFields, setBlockingFields] = useState<string[]>([])
  const [blockingMsg, setBlockingMsg] = useState('')
  const [blockingOpen, setBlockingOpen] = useState(false)
  const [lossOpen, setLossOpen] = useState(false)
  const [lossMotive, setLossMotive] = useState<MotivoPerdaTipo | ''>('')
  const [lossDesc, setLossDesc] = useState('')
  const [newNote, setNewNote] = useState('')
  const [isPJ, setIsPJ] = useState(false)
  const [socios, setSocios] = useState<{ nome: string; contato: string }[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<{ file: File; nome_descricao: string }[]>([])

  const [historico, setHistorico] = useState<(HistoricoInteracao & { autor_nome?: string })[]>([])
  const [documentos, setDocumentos] = useState<DocumentoLead[]>([])
  const [consultores, setConsultores] = useState<Perfil[]>([])

  // Sections
  const [openSections, setOpenSections] = useState({ basico: true, negociacao: true, contratual: true, docs: true, financeiro: true, historico: true })

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      
      const { data: leadData } = await supabase.from('leads').select('*').eq('id', Number(id)).single()
      if (!leadData) { setLoading(false); return }
      setLead(leadData as Lead)
      setIsPJ(!!(leadData as Lead).cnpj)
      setSocios(((leadData as Lead).socios as { nome: string; contato: string }[]) || [])

      // Fetch related data in parallel
      const [historicoRes, docsRes, consultoresRes] = await Promise.all([
        supabase.from('historico_interacoes').select('*').eq('lead_id', Number(id)).order('created_at', { ascending: false }),
        supabase.from('documentos_lead').select('*').eq('lead_id', Number(id)),
        supabase.from('perfis').select('*').eq('role', 'consultor').eq('status', 'ativo'),
      ])

      // Fetch author names for historico
      const autorIds = [...new Set((historicoRes.data || []).map(h => h.autor_id))]
      let autorNames: Record<string, string> = {}
      if (autorIds.length > 0) {
        const { data: autores } = await supabase.from('perfis').select('id, nome_completo').in('id', autorIds)
        autores?.forEach(a => { autorNames[a.id] = a.nome_completo })
      }

      setHistorico((historicoRes.data || []).map(h => ({ ...h, autor_nome: autorNames[h.autor_id] })) as (HistoricoInteracao & { autor_nome?: string })[])
      setDocumentos((docsRes.data || []) as DocumentoLead[])
      setConsultores((consultoresRes.data || []) as Perfil[])
      setLoading(false)
    }
    fetchData()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!lead) return <div className="p-8 text-center text-muted-foreground">Lead não encontrado</div>

  const updateField = <K extends keyof Lead>(field: K, value: Lead[K]) => {
    setLead(prev => {
      if (!prev) return prev
      const updated = { ...prev, [field]: value }
      if (field === 'valor_bruto' || field === 'porcentagem_desconto') {
        const bruto = field === 'valor_bruto' ? (value as number | null) : prev.valor_bruto
        const desc = field === 'porcentagem_desconto' ? (value as number | null) : prev.porcentagem_desconto
        updated.valor_liquido = calculateValorLiquido(bruto, desc)
      }
      return updated
    })
  }

  const handleSave = async () => {
    if (!lead) return
    setSaving(true)
    const { error } = await supabase.from('leads').update({
      nome: lead.nome,
      telefone: lead.telefone,
      origem: lead.origem,
      necessidade: lead.necessidade,
      consultor_id: lead.consultor_id,
      servico_interesse: lead.servico_interesse,
      valor_bruto: lead.valor_bruto,
      porcentagem_desconto: lead.porcentagem_desconto,
      valor_liquido: lead.valor_liquido,
      email: lead.email,
      rg: lead.rg,
      cpf: lead.cpf,
      cnpj: lead.cnpj,
      razao_social: lead.razao_social,
      contato_numero: lead.contato_numero,
      socios: socios.length > 0 ? socios : null,
      status_financeiro: lead.status_financeiro,
      data_prevista_pagamento: lead.data_prevista_pagamento,
      status: lead.status,
      motivo_perda_tipo: lead.motivo_perda_tipo,
      motivo_perda_descricao: lead.motivo_perda_descricao,
    }).eq('id', lead.id)

    setSaving(false)
    if (error) {
      toast.error('Erro ao salvar: ' + error.message)
    } else {
      toast.success('Lead salvo com sucesso!')
    }
  }

  const validateAdvance = (): boolean => {
    const missing: string[] = []

    if (lead.status === 'atendimento') {
      if (!lead.origem) missing.push('Origem')
      if (!lead.necessidade) missing.push('Necessidade Identificada')
    } else if (lead.status === 'negociacao') {
      if (!lead.servico_interesse) missing.push('Serviço de Interesse')
      if (!lead.valor_bruto) missing.push('Valor Bruto')
      if (!lead.email) missing.push('E-mail')
      if (!lead.rg) missing.push('RG')
      if (!lead.cpf) missing.push('CPF')
      if (isPJ && !lead.cnpj) missing.push('CNPJ')
      if (isPJ && !lead.razao_social) missing.push('Razão Social')
      const totalDocs = documentos.length + uploadedFiles.length
      if (totalDocs === 0) missing.push('Ao menos 1 documento enviado')
      if (uploadedFiles.some(f => !f.nome_descricao.trim())) missing.push('Descrição obrigatória em todos os documentos anexados')
      if (lead.status_financeiro !== 'pago') {
        setBlockingFields(['Confirme o pagamento antes de fechar este lead.'])
        setBlockingMsg('O status financeiro deve estar como "Pago" para avançar.')
        setBlockingOpen(true)
        return false
      }
    }

    if (missing.length > 0) {
      setBlockingFields(missing)
      setBlockingMsg('')
      setBlockingOpen(true)
      return false
    }
    return true
  }

  const handleAdvance = async () => {
    if (!validateAdvance()) return
    const nextStatus = lead.status === 'atendimento' ? 'negociacao' : lead.status === 'negociacao' ? 'fechado' : lead.status

    const { error } = await supabase.from('leads').update({ status: nextStatus }).eq('id', lead.id)
    if (error) {
      toast.error('Erro ao avançar: ' + error.message)
      return
    }

    setLead(prev => prev ? { ...prev, status: nextStatus as Lead['status'] } : prev)
    toast.success(`Lead avançou para ${lead.status === 'atendimento' ? 'Negociação' : 'Fechado'}!`)
  }

  const canAdvance = lead.status === 'atendimento' || lead.status === 'negociacao'
  const canLose = (lead.status === 'atendimento' || lead.status === 'negociacao') && canMarkAsLost(lead.consultor_id)
  const canInactivate = lead.status === 'fechado' && canInactivateLead(lead.consultor_id)

  const handleLoss = async () => {
    if (!lossMotive) return
    if (lossMotive === 'outro' && !lossDesc.trim()) return

    const { error } = await supabase.from('leads').update({
      status: 'perdido',
      motivo_perda_tipo: lossMotive as MotivoPerdaTipo,
      motivo_perda_descricao: lossMotive === 'outro' ? lossDesc : null,
    }).eq('id', lead.id)

    if (error) {
      toast.error('Erro ao marcar como perdido')
      return
    }

    setLead(prev => prev ? { ...prev, status: 'perdido', motivo_perda_tipo: lossMotive as MotivoPerdaTipo, motivo_perda_descricao: lossMotive === 'outro' ? lossDesc : null } : prev)
    setLossOpen(false)
    toast.success('Lead marcado como perdido')
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || !user) return
    const { data, error } = await supabase.from('historico_interacoes').insert({
      lead_id: Number(id),
      autor_id: user.id,
      anotacao: newNote.trim(),
    }).select().single()

    if (error) {
      toast.error('Erro ao registrar anotação')
      return
    }

    setHistorico(prev => [{ ...data, autor_nome: user.nome_completo } as (HistoricoInteracao & { autor_nome?: string }), ...prev])
    setNewNote('')
    toast.success('Anotação registrada!')
  }

  const addSocio = () => setSocios(prev => [...prev, { nome: '', contato: '' }])
  const removeSocio = (idx: number) => setSocios(prev => prev.filter((_, i) => i !== idx))

  const showNegociacao = ['negociacao', 'fechado', 'perdido', 'inativo'].includes(lead.status)
  const showContratual = ['negociacao', 'fechado', 'inativo'].includes(lead.status)

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-24 md:pb-8">
      <PageHeader
        title={lead.nome}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={lead.status} />
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
            {canAdvance && (
              <Button onClick={handleAdvance} variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                <ArrowRight className="mr-2 h-4 w-4" /> Avançar Etapa
              </Button>
            )}
            {canLose && (
              <Button onClick={() => setLossOpen(true)} variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                <XCircle className="mr-2 h-4 w-4" /> Marcar como Perdido
              </Button>
            )}
            {canInactivate && (
              <Button variant="outline" className="border-muted-foreground text-muted-foreground" onClick={async () => {
                try {
                  const updated = await inactivateLeadService(lead)
                  setLead(updated)
                  toast.success('Cliente inativado')
                } catch (err) {
                  toast.error(`Erro ao inativar: ${(err as Error).message}`)
                }
              }}>
                <UserX className="mr-2 h-4 w-4" /> Inativar
              </Button>
            )}
          </div>
        }
      />

      {/* Section 1 - Basic Data */}
      <Collapsible open={openSections.basico} onOpenChange={v => setOpenSections(p => ({ ...p, basico: v }))}>
        <CollapsibleTrigger className={cn("flex w-full items-center justify-between bg-card border border-border p-4", openSections.basico ? "rounded-t-lg" : "rounded-lg")}>
          <h3 className="font-semibold text-foreground">Dados Básicos</h3>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openSections.basico && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-b-lg border border-t-0 border-border bg-card p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Nome</Label>
              <Input value={lead.nome} onChange={e => updateField('nome', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Telefone</Label>
              <Input value={lead.telefone} onChange={e => updateField('telefone', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Origem</Label>
              <Select value={lead.origem || ''} onValueChange={v => updateField('origem', v as LeadOrigem)}>
                <SelectTrigger className="bg-background border-border text-foreground"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.entries(LEAD_ORIGEM_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-foreground focus:bg-surface-elevated">{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Necessidade Identificada</Label>
              <Select value={lead.necessidade || ''} onValueChange={v => updateField('necessidade', v as LeadNecessidade)}>
                <SelectTrigger className="bg-background border-border text-foreground"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.entries(LEAD_NECESSIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-foreground focus:bg-surface-elevated">{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {canAssignConsultor && (
              <div className="space-y-2">
                <Label className="text-foreground">Consultor</Label>
                <Select value={lead.consultor_id} onValueChange={v => updateField('consultor_id', v)}>
                  <SelectTrigger className="bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {consultores.map(c => <SelectItem key={c.id} value={c.id} className="text-foreground focus:bg-surface-elevated">{c.nome_completo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Data de Cadastro</Label>
              <Input value={new Date(lead.created_at).toLocaleDateString('pt-BR')} readOnly className="bg-background border-border text-muted-foreground" />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Section 2 - Negotiation */}
      {showNegociacao && (
        <Collapsible open={openSections.negociacao} onOpenChange={v => setOpenSections(p => ({ ...p, negociacao: v }))}>
          <CollapsibleTrigger className={cn("flex w-full items-center justify-between bg-card border border-border p-4", openSections.negociacao ? "rounded-t-lg" : "rounded-lg")}>
            <h3 className="font-semibold text-foreground">Negociação</h3>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openSections.negociacao && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent className="rounded-b-lg border border-t-0 border-border bg-card p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-foreground">Serviço de Interesse</Label>
                <Select value={lead.servico_interesse || ''} onValueChange={v => updateField('servico_interesse', v as ServicoInteresse)}>
                  <SelectTrigger className="bg-background border-border text-foreground"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {Object.entries(SERVICO_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-foreground focus:bg-surface-elevated">{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Valor Bruto (R$)</Label>
                <Input type="number" value={lead.valor_bruto || ''} onChange={e => updateField('valor_bruto', Number(e.target.value) || null)} className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Desconto (%)</Label>
                <Input type="number" min={0} max={100} step={0.01} value={lead.porcentagem_desconto || ''} onChange={e => updateField('porcentagem_desconto', Number(e.target.value) || null)} className="bg-background border-border" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-foreground">Valor Líquido (R$)</Label>
                <Input value={lead.valor_liquido ? `R$ ${lead.valor_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''} readOnly className="bg-background border-border text-primary font-bold" />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Section 3 - Contract */}
      {showContratual && (
        <Collapsible open={openSections.contratual} onOpenChange={v => setOpenSections(p => ({ ...p, contratual: v }))}>
          <CollapsibleTrigger className={cn("flex w-full items-center justify-between bg-card border border-border p-4", openSections.contratual ? "rounded-t-lg" : "rounded-lg")}>
            <h3 className="font-semibold text-foreground">Dados Contratuais</h3>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openSections.contratual && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent className="rounded-b-lg border border-t-0 border-border bg-card p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">E-mail</Label>
                <Input value={lead.email || ''} onChange={e => updateField('email', e.target.value)} className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">RG</Label>
                <Input value={lead.rg || ''} onChange={e => updateField('rg', e.target.value)} className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">CPF</Label>
                <Input value={lead.cpf || ''} onChange={e => updateField('cpf', e.target.value)} placeholder="000.000.000-00" className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Contato Adicional</Label>
                <Input value={lead.contato_numero || ''} onChange={e => updateField('contato_numero', e.target.value)} className="bg-background border-border" />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox checked={isPJ} onCheckedChange={v => setIsPJ(!!v)} id="pj" />
              <Label htmlFor="pj" className="text-foreground cursor-pointer">Pessoa Jurídica</Label>
            </div>

            {isPJ && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">CNPJ</Label>
                  <Input value={lead.cnpj || ''} onChange={e => updateField('cnpj', e.target.value)} placeholder="00.000.000/0001-00" className="bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Razão Social</Label>
                  <Input value={lead.razao_social || ''} onChange={e => updateField('razao_social', e.target.value)} className="bg-background border-border" />
                </div>
              </div>
            )}

            {/* Sócios */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-foreground">Sócios</Label>
                <Button variant="outline" size="sm" onClick={addSocio} className="border-border text-foreground"><Plus className="mr-1 h-3 w-3" /> Adicionar Sócio</Button>
              </div>
              {socios.map((s, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input placeholder="Nome" value={s.nome} onChange={e => { const u = [...socios]; u[i].nome = e.target.value; setSocios(u) }} className="bg-background border-border flex-1" />
                  <Input placeholder="Contato" value={s.contato} onChange={e => { const u = [...socios]; u[i].contato = e.target.value; setSocios(u) }} className="bg-background border-border flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => removeSocio(i)} className="text-muted-foreground hover:text-destructive h-8 w-8"><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Section 4 - Documents */}
      <Collapsible open={openSections.docs} onOpenChange={v => setOpenSections(p => ({ ...p, docs: v }))}>
        <CollapsibleTrigger className={cn("flex w-full items-center justify-between bg-card border border-border p-4", openSections.docs ? "rounded-t-lg" : "rounded-lg")}>
          <h3 className="font-semibold text-foreground">Documentos ({documentos.length + uploadedFiles.length})</h3>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openSections.docs && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-b-lg border border-t-0 border-border bg-card p-4 space-y-4">
          <FileUpload onFilesChange={setUploadedFiles} />
          {documentos.length > 0 && (
            <div className="space-y-2">
              {documentos.map(doc => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg bg-background border border-border p-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge status="ativo" className="uppercase text-[10px]" />
                    <div>
                      <p className="text-sm text-foreground">{doc.nome_descricao}</p>
                      <p className="text-xs text-muted-foreground">{doc.formato.toUpperCase()} • {new Date(doc.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">Download</Button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Section 5 - Financial */}
      {showNegociacao && (
        <Collapsible open={openSections.financeiro} onOpenChange={v => setOpenSections(p => ({ ...p, financeiro: v }))}>
          <CollapsibleTrigger className={cn("flex w-full items-center justify-between bg-card border border-border p-4", openSections.financeiro ? "rounded-t-lg" : "rounded-lg")}>
            <h3 className="font-semibold text-foreground">Status Financeiro</h3>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openSections.financeiro && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent className="rounded-b-lg border border-t-0 border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-4">
              <Label className="text-foreground">Status:</Label>
              <div className="flex items-center gap-2">
                <span className={cn('text-sm', lead.status_financeiro === 'pendente' ? 'text-warning' : 'text-muted-foreground')}>Pendente</span>
                <Switch
                  checked={lead.status_financeiro === 'pago'}
                  onCheckedChange={v => updateField('status_financeiro', v ? 'pago' : 'pendente')}
                />
                <span className={cn('text-sm', lead.status_financeiro === 'pago' ? 'text-success' : 'text-muted-foreground')}>Pago</span>
              </div>
            </div>
            <div className="space-y-2 max-w-xs">
              <Label className="text-foreground">Dia previsto para pagamento</Label>
              <Input type="number" min={1} max={31} value={lead.data_prevista_pagamento || ''} onChange={e => updateField('data_prevista_pagamento', Number(e.target.value) || null)} className="bg-background border-border" />
            </div>
            {lead.status_financeiro === 'pendente' && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <span className="text-sm text-destructive font-medium">⚠ Pagamento pendente — lead não pode ser fechado.</span>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Section 6 - Interaction History */}
      <Collapsible open={openSections.historico} onOpenChange={v => setOpenSections(p => ({ ...p, historico: v }))}>
        <CollapsibleTrigger className={cn("flex w-full items-center justify-between bg-card border border-border p-4", openSections.historico ? "rounded-t-lg" : "rounded-lg")}>
          <h3 className="font-semibold text-foreground">Histórico de Interações ({historico.length})</h3>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openSections.historico && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-b-lg border border-t-0 border-border bg-card p-4 space-y-4">
          {canAddInteraction(lead.consultor_id) && (
            <div className="space-y-2">
              <Textarea placeholder="Registrar nova anotação..." value={newNote} onChange={e => setNewNote(e.target.value)} className="bg-background border-border min-h-[80px]" />
              <Button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                size="sm"
              >
                Registrar
              </Button>
            </div>
          )}
          <div className="space-y-4">
            {historico.map(h => {
              const initials = h.autor_nome?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'
              return (
                <div key={h.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/20 text-primary text-xs">{initials}</AvatarFallback></Avatar>
                    <div className="flex-1 w-px bg-border mt-2" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">{h.autor_nome || 'Desconhecido'}</span>
                      <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{h.anotacao}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Loss reason (if lost) */}
      {lead.status === 'perdido' && lead.motivo_perda_tipo && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
          <p className="text-sm font-medium text-destructive mb-1">Motivo da Perda</p>
          <p className="text-sm text-foreground">{MOTIVO_PERDA_LABELS[lead.motivo_perda_tipo]}</p>
          {lead.motivo_perda_descricao && <p className="text-sm text-muted-foreground mt-1">{lead.motivo_perda_descricao}</p>}
        </div>
      )}

      {/* Blocking Modal */}
      <BlockingModal open={blockingOpen} onOpenChange={setBlockingOpen} fields={blockingFields} message={blockingMsg} />

      {/* Loss Dialog */}
      <ConfirmDialog
        open={lossOpen}
        onOpenChange={setLossOpen}
        title="Marcar como Perdido"
        message="Selecione o motivo da perda:"
        onConfirm={handleLoss}
        confirmLabel="Confirmar Perda"
        destructive
      />
      {lossOpen && (
        <Dialog open={lossOpen} onOpenChange={setLossOpen}>
          {/* Custom loss dialog handled below */}
        </Dialog>
      )}

      {/* Mobile sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-card border-t border-border p-4 flex gap-2 z-20">
        <Button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground" size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
        </Button>
        {canAdvance && (
          <Button onClick={handleAdvance} variant="outline" className="flex-1 border-primary text-primary" size="sm">Avançar</Button>
        )}
      </div>
    </div>
  )
}
