import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type BadgeStatus = 'atendimento' | 'negociacao' | 'fechado' | 'perdido' | 'inativo' | 'pago' | 'pendente' | 'ativo' | 'admin' | 'consultor'

const statusConfig: Record<BadgeStatus, { label: string; className: string }> = {
  atendimento: { label: 'Atendimento', className: 'bg-warning/20 text-warning border-warning/30' },
  negociacao: { label: 'Negociação', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  fechado: { label: 'Fechado', className: 'bg-success/20 text-success border-success/30' },
  perdido: { label: 'Perdido', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  inativo: { label: 'Inativo', className: 'bg-muted text-muted-foreground border-border' },
  pago: { label: 'Pago', className: 'bg-success/20 text-success border-success/30' },
  pendente: { label: 'Pendente', className: 'bg-warning/20 text-warning border-warning/30' },
  ativo: { label: 'Ativo', className: 'bg-success/20 text-success border-success/30' },
  admin: { label: 'Admin', className: 'bg-primary/20 text-primary border-primary/30' },
  consultor: { label: 'Consultor', className: 'bg-info/20 text-info border-info/30' },
}

interface StatusBadgeProps {
  status: BadgeStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', config.className, className)}>
      {config.label}
    </Badge>
  )
}
