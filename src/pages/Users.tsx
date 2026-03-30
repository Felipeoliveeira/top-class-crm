import { useState } from 'react'
import { z } from 'zod'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/useAuth'
import { usePerfisAdmin, useInviteUser, useResendInvite, useTogglePerfilStatus } from '@/hooks/useUsers'
import type { Perfil, Role } from '@/types'
import { Plus, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const inviteFormSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome completo'),
  email: z.string().trim().email('E-mail inválido'),
  role: z.enum(['admin', 'consultor']),
})

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const { data: users = [], isLoading } = usePerfisAdmin()
  const inviteMutation = useInviteUser()
  const resendMutation = useResendInvite()
  const toggleMutation = useTogglePerfilStatus()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('consultor')

  const resetInviteForm = () => {
    setNome('')
    setEmail('')
    setRole('consultor')
  }

  const handleInvite = async () => {
    const parsed = inviteFormSchema.safeParse({ nome, email, role })
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const msg = first.nome?.[0] ?? first.email?.[0] ?? first.role?.[0] ?? 'Verifique os campos'
      toast.error(msg)
      return
    }

    try {
      await inviteMutation.mutateAsync({
        nome_completo: parsed.data.nome,
        email: parsed.data.email,
        role: parsed.data.role,
      })
      toast.success('Convite enviado! O link leva para definir senha (válido por 24h).')
      setInviteOpen(false)
      resetInviteForm()
    } catch (e) {
      toast.error((e as Error).message || 'Erro ao enviar convite')
    }
  }

  const handleResend = async (u: Perfil) => {
    try {
      await resendMutation.mutateAsync(u.email)
      toast.success('Novo convite enviado por e-mail.')
    } catch (e) {
      toast.error((e as Error).message || 'Erro ao reenviar convite')
    }
  }

  const toggleStatus = async (u: Perfil) => {
    const newStatus = u.status === 'ativo' ? 'inativo' : 'ativo'
    try {
      await toggleMutation.mutateAsync({ id: u.id, status: newStatus })
      toast.success(newStatus === 'ativo' ? 'Usuário ativado.' : 'Usuário desativado.')
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const saving = inviteMutation.isPending

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <PageHeader
          title="Usuários"
          subtitle={`${users.length} usuários cadastrados · Convites abrem em /definir-senha`}
          actions={
            <Button onClick={() => setInviteOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Convidar Usuário
            </Button>
          }
        />

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="bg-card">
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Nome</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">E-mail</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Role</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Último acesso</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const initials = u.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)
                const isSelf = currentUser?.id === u.id
                const podeReenviar = !u.ultimo_acesso && u.status === 'ativo'
                return (
                  <tr
                    key={u.id}
                    className={`border-t border-border hover:bg-card/80 transition-colors ${u.status === 'inativo' ? 'opacity-60' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-foreground">{u.nome_completo}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{u.email}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={u.role} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={u.status === 'ativo'}
                          disabled={isSelf || toggleMutation.isPending}
                          onCheckedChange={() => toggleStatus(u)}
                          aria-label={u.status === 'ativo' ? 'Desativar usuário' : 'Ativar usuário'}
                        />
                        {podeReenviar && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-primary"
                                disabled={resendMutation.isPending}
                                onClick={() => handleResend(u)}
                              >
                                {resendMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">Reenviar convite de primeiro acesso (novo link 24h)</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <Dialog open={inviteOpen} onOpenChange={open => { setInviteOpen(open); if (!open) resetInviteForm() }}>
          <DialogContent className="border-border bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Convidar usuário</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                O convidado recebe um e-mail com link para <strong>/definir-senha</strong> (sem senha temporária). Link expira em 24h.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-nome" className="text-foreground">
                  Nome completo *
                </Label>
                <Input
                  id="invite-nome"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="bg-background border-border"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email" className="text-foreground">
                  E-mail *
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-background border-border"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Role *</Label>
                <Select value={role} onValueChange={v => setRole(v as Role)}>
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="admin" className="text-foreground focus:bg-surface-elevated">
                      Admin
                    </SelectItem>
                    <SelectItem value="consultor" className="text-foreground focus:bg-surface-elevated">
                      Consultor
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)} className="border-border text-foreground">
                Cancelar
              </Button>
              <Button
                onClick={handleInvite}
                disabled={saving}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar convite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
