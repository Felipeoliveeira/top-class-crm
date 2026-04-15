import { useMemo, useEffect, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { PageHeader } from '@/components/PageHeader'
import { KpiCard } from '@/components/KpiCard'
import { usePermissions } from '@/hooks/usePermissions'
import { useDashboardCharts, useDashboardKpis, useConsultoresPerformanceTable } from '@/hooks/useDashboard'
import { computeConsultorPerformance } from '@/services/dashboard'
import type { DashboardFilterInput, TimeFilter } from '@/services/dashboard'
import { Users, TrendingUp, CheckCircle, DollarSign, XCircle, TrendingDown, Percent, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { toast } from 'sonner'

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
  outros: '#64748B',
}

export default function DashboardPage() {
  const { canViewFinancialKpis, canViewPerformanceTable } = usePermissions()
  const [presetFilter, setPresetFilter] = useState<TimeFilter>('30dias')
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined)
  const [isCustomFilterActive, setIsCustomFilterActive] = useState(false)

  const filter = useMemo<DashboardFilterInput>(() => {
    if (isCustomFilterActive && customRange?.from && customRange?.to) {
      return {
        type: 'custom',
        from: customRange.from.toISOString(),
        to: customRange.to.toISOString(),
      }
    }
    return presetFilter
  }, [customRange?.from, customRange?.to, isCustomFilterActive, presetFilter])

  const { kpis, isLoading: loadingKpis, isError, error } = useDashboardKpis(filter)
  const { charts, leads } = useDashboardCharts(filter)

  const { data: consultores = [], isLoading: loadingConsultores } = useConsultoresPerformanceTable(
    canViewPerformanceTable,
  )

  const performanceRows = useMemo(
    () => (canViewPerformanceTable ? computeConsultorPerformance(leads, consultores) : []),
    [leads, consultores, canViewPerformanceTable],
  )

  useEffect(() => {
    if (isError && error) {
      toast.error(`Erro ao carregar dashboard: ${(error as Error).message}`)
    }
  }, [isError, error])

  const loading = loadingKpis || (canViewPerformanceTable && loadingConsultores)

  const { daily: dailyData, origem: origemData, clientesOrigem: clientesOrigemData, servico: servicoData, clientesServico: clientesServicoData } = charts

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={canViewPerformanceTable ? 'Visão geral do time comercial' : 'Visão geral do funil'} />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(filterLabels) as TimeFilter[]).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setPresetFilter(f)
              setIsCustomFilterActive(false)
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${!isCustomFilterActive && f === presetFilter ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-surface-elevated'}`}
          >
            {filterLabels[f]}
          </button>
        ))}
        <DateRangePicker
          value={customRange}
          onChange={range => {
            setCustomRange(range)
            setIsCustomFilterActive(Boolean(range?.from && range?.to))
          }}
          placeholder="Personalizado"
          fixedLabel
          buttonClassName={
            isCustomFilterActive
              ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
              : 'border-transparent bg-card text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
          }
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Leads Totais" value={kpis.totalLeads} icon={Users} />
        <KpiCard title="Taxa de Conversão" value={`${kpis.conversionRate}%`} icon={TrendingUp} />
        <KpiCard
          title={canViewFinancialKpis ? 'Negócios Ganhos' : 'Negócios Fechados'}
          value={kpis.negociosGanhos}
          icon={CheckCircle}
          iconColor="text-success"
        />
        {canViewFinancialKpis ? (
          <KpiCard
            title="Valor Total Ganho"
            value={`R$ ${kpis.valorGanho.toLocaleString('pt-BR')}`}
            icon={DollarSign}
            iconColor="text-success"
          />
        ) : (
          <KpiCard title="Negócios Perdidos" value={kpis.negociosPerdidos} icon={XCircle} iconColor="text-destructive" />
        )}
      </div>

      {canViewFinancialKpis && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard title="Negócios Perdidos" value={kpis.negociosPerdidos} icon={XCircle} iconColor="text-destructive" />
          <KpiCard
            title="Valor Perdido"
            value={`R$ ${kpis.valorPerdido.toLocaleString('pt-BR')}`}
            icon={TrendingDown}
            iconColor="text-destructive"
          />
          <KpiCard
            title="Total Descontos"
            value={`R$ ${kpis.totalDescontos.toLocaleString('pt-BR')}`}
            icon={Percent}
            iconColor="text-warning"
          />
        </div>
      )}

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
                  {origemData.map(entry => (
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
                  {clientesOrigemData.map(entry => (
                    <Cell key={entry.key} fill={origemColors[entry.key]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

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
                  {performanceRows.map(row => (
                    <tr key={row.perfil.id} className="border-b border-border/50 hover:bg-surface-elevated transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/20 text-primary text-xs">{row.initials}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-foreground">{row.perfil.nome_completo}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4 text-sm text-foreground">{row.totalLeads}</td>
                      <td className="text-center py-3 px-4 text-sm text-foreground">{row.ganhos}</td>
                      <td className="text-center py-3 px-4 text-sm text-foreground">{row.conversaoPct}%</td>
                      <td className="text-right py-3 px-4 text-sm font-medium text-foreground">
                        R$ {row.valorGanho.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
