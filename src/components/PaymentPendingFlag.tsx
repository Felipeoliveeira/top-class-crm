import { AlertTriangle } from 'lucide-react'

export function PaymentPendingFlag() {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-destructive/20 px-2 py-1 text-xs font-semibold text-destructive animate-pulse-slow">
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>⚠ Pagamento Pendente</span>
    </div>
  )
}
