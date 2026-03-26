import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface KpiCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  trend?: 'up' | 'down'
  trendValue?: string
  isLoading?: boolean
}

export function KpiCard({ title, value, icon: Icon, iconColor, trend, trendValue, isLoading }: KpiCardProps) {
  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-8 w-32" />
          <Skeleton className="mt-2 h-3 w-20" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card hover:bg-surface-elevated transition-colors">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={cn('rounded-lg p-2.5', iconColor ? '' : 'bg-primary/10')}>
            <Icon className={cn('h-5 w-5', iconColor || 'text-primary')} />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold text-foreground">{value}</p>
        {trend && trendValue && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            {trend === 'up' ? (
              <TrendingUp className="h-3 w-3 text-success" />
            ) : (
              <TrendingDown className="h-3 w-3 text-destructive" />
            )}
            <span className={trend === 'up' ? 'text-success' : 'text-destructive'}>{trendValue}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
