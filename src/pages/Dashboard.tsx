import { useState, useEffect, useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { KpiCard } from '@/components/KpiCard'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { supabase } from '@/integrations/supabase/client'
import { LEAD_ORIGEM_LABELS, SERVICO_LABELS } from '@/types'
import type { LeadOrigem, Lead, Perfil } from '@/types'
import { Users, TrendingUp, CheckCircle, DollarSign, XCircle, TrendingDown, Percent, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

type TimeFilter = 'hoje' | '7dias' | '30dias' | 'total'

const filterLabels: Record<TimeFilter, string> = {
  hoje: 'Hoje',
  '7dias': '7 dias',
  '30dias': '30 dias',
  total: 'Total',
}

const origemColors: Record<string, string> = {
  indicacao: '#C50B40',
  google: '#3B82F6',
  placa: '#D97706',
  rede_social: '#16A34A',
}

function getDateFilter(filter: TimeFilter): string | null {
  const now = new Date()
  if (filter === 'hoje') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  if (filter === '7dias') { now.setDate(now.getDate() - 7); return now.toISOString() }
  if (filter === '30dias') { now.setDate(now.getDate() - 30); return now.toISOString() }
  return null
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { canViewAllDashboard, canViewFinancialKpis, canViewPerformanceTable } = usePermissions()
  const [filter, setFilter] = useState<TimeFilter>('30dias')
  const [leads, setLeads] = useState<Lead[]>([])
  const [consultores, setConsultores] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      let query = supabase.from('leads').select('*')
      const dateFilter = getDateFilter(filter)
      if (dateFilter) query = query.gte('created_at', dateFilter)
      
      const { data: leadsData } = await query
      setLeads((leadsData as Lead[]) || [])

      if (canViewPerformanceTable) {
        const { data: perfisData } = await supabase
          .from('perfis')
          .select('*')
          .eq('role', 'consultor')
          .eq('status', 'ativo')
        setConsultores((perfisData as Perfil[]) || [])
      }
      setLoading(false)
    }
    fetchData()
  }, [filter, canViewPerformanceTable])

  const totalLeads = leads.length
  const fechados = leads.filter(l => l.status === 'fechado')
  const perdidos = leads.filter(l => l.status === 'perdido')
  const conversionRate = totalLeads > 0 ? Math.round((fechados.length / Math.max(totalLeads - perdidos.length, 1)) * 100) : 0
  const valorGanho = fechados.filter(l => l.status_financeiro === 'pago').reduce((sum, l) => sum + (l.valor_liquido || 0), 0)
  const valorPerdido = perdidos.reduce((sum, l) => sum + (l.valor_bruto || 0), 0)
  const totalDescontos = fechados.reduce((sum, l) => sum + ((l.valor_bruto || 0) - (l.valor_liquido || 0)), 0)

  const origemData = (['indicacao', 'google', 'placa', 'rede_social'] as LeadOrigem[]).map(o => ({
    name: LEAD_ORIGEM_LABELS[o],
    value: leads.filter(l => l.origem === o).length,
    key: o,
  }))

  const clientesOrigemData = (['indicacao', 'google', 'placa', 'rede_social'] as LeadOrigem[]).map(o => ({
    name: LEAD_ORIGEM_LABELS[o],
    value: fechados.filter(l => l.origem === o).length,
    key: o,
  }))

  const servicoData = Object.entries(SERVICO_LABELS).map(([key, label]) => ({
    name: label,
    value: leads.filter(l => l.servico_interesse === key).length,
  })).sort((a, b) => b.value - a.value)

  const clientesServicoData = Object.entries(SERVICO_LABELS).map(([key, label]) => ({
    name: label,
    value: fechados.filter(l => l.servico_interesse === key).length,
  })).sort((a, b) => b.value - a.value)

  // Daily data from actual leads
  const dailyData = useMemo(() => {
    const days: Record<string, { leads: number; ganhos: number }> = {}
    leads.forEach(l => {
      const d = l.created_at.split('T')[0]
      if (!days[d]) days[d] = { leads: 0, ganhos: 0 }
      days[d].leads++
      if (l.status === 'fechado') days[d].ganhos++
    })
    return Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }))
  }, [leads])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={canViewAllDashboard ? 'Visão geral do time comercial' : 'Meus resultados'} />

      {/* Time filter */}
      <div className="flex gap-2">
        {(Object.keys(filterLabels) as TimeFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${f === filter ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-surface-elevated'}`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Leads Totais" value={totalLeads} icon={Users} />
        <KpiCard title="Taxa de Conversão" value={`${conversionRate}%`} icon={TrendingUp} />
        <KpiCard title="Negócios Ganhos" value={fechados.length} icon={CheckCircle} iconColor="text-success" />
        {canViewFinancialKpis ? (
          <KpiCard title="Valor Total Ganho" value={`R$ ${valorGanho.toLocaleString('pt-BR')}`} icon={DollarSign} iconColor="text-success" />
        ) : (
          <KpiCard title="Negócios Perdidos" value={perdidos.length} icon={XCircle} iconColor="text-destructive" />
        )}
      </div>

      {/* KPI Row 2 - Admin only */}
      {canViewFinancialKpis && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard title="Negócios Perdidos" value={perdidos.length} icon={XCircle} iconColor="text-destructive" />
          <KpiCard title="Valor Perdido" value={`R$ ${valorPerdido.toLocaleString('pt-BR')}`} icon={TrendingDown} iconColor="text-destructive" />
          <KpiCard title="Total Descontos" value={`R$ ${totalDescontos.toLocaleString('pt-BR')}`} icon={Percent} iconColor="text-warning" />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Leads e Ganhos por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(213, 32%, 26%)" />
                <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1A2438', border: '1px solid #2D3F57', borderRadius: 8, color: '#F1F5F9' }} />
                <Line type="monotone" dataKey="leads" stroke="#94A3B8" strokeWidth={2} dot={false} name="Leads" />
                <Line type="monotone" dataKey="ganhos" stroke="#C50B40" strokeWidth={2} dot={false} name="Ganhos" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Leads por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={origemData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(213, 32%, 26%)" />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1A2438', border: '1px solid #2D3F57', borderRadius: 8, color: '#F1F5F9' }} formatter={(value: number) => [<span style={{ color: '#C50B40', fontWeight: 600 }}>{value}</span>, 'Leads']} />
                <Bar dataKey="value" name="Leads" radius={[4, 4, 0, 0]}>
                  {origemData.map((entry) => (
                    <Cell key={entry.key} fill={origemColors[entry.key]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Clientes por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={clientesOrigemData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(213, 32%, 26%)" />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1A2438', border: '1px solid #2D3F57', borderRadius: 8, color: '#F1F5F9' }} formatter={(value: number) => [<span style={{ color: '#C50B40', fontWeight: 600 }}>{value}</span>, 'Clientes']} />
                <Bar dataKey="value" name="Clientes" radius={[4, 4, 0, 0]}>
                  {clientesOrigemData.map((entry) => (
                    <Cell key={entry.key} fill={origemColors[entry.key]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Leads por Plano/Serviço + Clientes por Plano/Serviço */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Leads por Plano/Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {servicoData.map(s => {
                const maxVal = Math.max(...servicoData.map(d => d.value), 1)
                return (
                  <div key={s.name} className="flex items-center gap-4">
                    <span className="w-48 text-sm text-foreground truncate">{s.name}</span>
                    <div className="flex-1 h-6 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(s.value / maxVal) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium text-foreground w-8 text-right">{s.value}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Clientes por Plano/Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clientesServicoData.map(s => {
                const maxVal = Math.max(...clientesServicoData.map(d => d.value), 1)
                return (
                  <div key={s.name} className="flex items-center gap-4">
                    <span className="w-48 text-sm text-foreground truncate">{s.name}</span>
                    <div className="flex-1 h-6 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(s.value / maxVal) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium text-foreground w-8 text-right">{s.value}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance table - Admin only */}
      {canViewPerformanceTable && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Performance por Consultor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Consultor</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Leads</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Ganhos</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Conversão</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Valor Ganho</th>
                  </tr>
                </thead>
                <tbody>
                  {consultores.map(c => {
                    const cLeads = leads.filter(l => l.consultor_id === c.id)
                    const cFechados = cLeads.filter(l => l.status === 'fechado')
                    const cPerdidos = cLeads.filter(l => l.status === 'perdido')
                    const cConv = cLeads.length > 0 ? Math.round((cFechados.length / Math.max(cLeads.length - cPerdidos.length, 1)) * 100) : 0
                    const cValor = cFechados.filter(l => l.status_financeiro === 'pago').reduce((s, l) => s + (l.valor_liquido || 0), 0)
                    const initials = c.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)
                    return (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-surface-elevated transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/20 text-primary text-xs">{initials}</AvatarFallback></Avatar>
                            <span className="text-sm text-foreground">{c.nome_completo}</span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4 text-sm text-foreground">{cLeads.length}</td>
                        <td className="text-center py-3 px-4 text-sm text-foreground">{cFechados.length}</td>
                        <td className="text-center py-3 px-4 text-sm text-foreground">{cConv}%</td>
                        <td className="text-right py-3 px-4 text-sm font-medium text-foreground">R$ {cValor.toLocaleString('pt-BR')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
