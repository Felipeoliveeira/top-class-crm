import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface BlockingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: string[]
  message?: string
}

export function BlockingModal({ open, onOpenChange, fields, message }: BlockingModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Não é possível avançar
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {message || 'Preencha os campos obrigatórios abaixo antes de prosseguir:'}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 py-4">
          {fields.map((field) => (
            <li key={field} className="flex items-center gap-2 text-sm text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              {field}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border bg-secondary text-foreground">
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
