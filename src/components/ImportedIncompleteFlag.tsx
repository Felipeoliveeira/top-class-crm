import { ClipboardX } from 'lucide-react'

export function ImportedIncompleteFlag() {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-warning/20 px-2 py-1 text-xs font-semibold text-warning">
      <ClipboardX className="h-3.5 w-3.5 shrink-0" />
      <span>Cliente importado — dados incompletos, verificar!</span>
    </div>
  )
}
