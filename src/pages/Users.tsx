import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { supabase } from '@/integrations/supabase/client'
import type { Perfil, Role } from '@/types'
import { Plus, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function UsersPage() {
  const [users, setUsers] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('consultor')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('perfis').select('*').order('created_at', { ascending: false })
        if (error) throw error
        setUsers((data as Perfil[]) || [])
      } catch (error) {
        setUsers([])
        toast.error(`Erro ao carregar usuários: ${(error as Error).message}`)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo'
    const { error } = await supabase.from('perfis').update({ status: newStatus }).eq('id', id)
    if (error) {
      toast.error('Erro ao atualizar status')
      return
    }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: newStatus as 'ativo' | 'inativo' } : u))
    toast.success('Status atualizado!')
  }

  const handleInvite = async () => {
    if (!nome.trim() || !email.trim()) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Sessão expirada. Faça login novamente.')
        return
      }

      const response = await supabase.functions.invoke('invite-user', {
        body: { email: email.trim(), nome_completo: nome.trim(), role },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (response.error) {
        toast.error(response.error.message || 'Erro ao enviar convite')
        return
      }

      if (response.data?.error) {
        toast.error(response.data.error)
        return
      }

      toast.success('Convite enviado com sucesso!')
      setInviteOpen(false)
      setNome('')
      setEmail('')
      setRole('consultor')

      // Atualizar lista de usuários
      const { data } = await supabase.from('perfis').select('*').order('created_at', { ascending: false })
      setUsers((data as Perfil[]) || [])
    } catch {
      toast.error('Erro inesperado ao enviar convite')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Usuários"
        subtitle={`${users.length} usuários cadastrados`}
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
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Usuário</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">E-mail</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Role</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Último Acesso</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const initials = u.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)
              return (
                <tr key={u.id} className={`border-t border-border hover:bg-card/80 transition-colors ${u.status === 'inativo' ? 'opacity-60' : ''}`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/20 text-primary text-xs">{initials}</AvatarFallback></Avatar>
                      <span className="text-sm font-medium text-foreground">{u.nome_completo}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{u.email}</td>
                  <td className="py-3 px-4"><StatusBadge status={u.role} /></td>
                  <td className="py-3 px-4"><StatusBadge status={u.status} /></td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleDateString('pt-BR') : 'Nunca'}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <Switch checked={u.status === 'ativo'} onCheckedChange={() => toggleStatus(u.id, u.status)} />
                      {!u.ultimo_acesso && (
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary" onClick={() => toast.success('Convite reenviado!')}>
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Convidar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-foreground">Nome Completo *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">E-mail *</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Role *</Label>
              <Select value={role} onValueChange={v => setRole(v as Role)}>
                <SelectTrigger className="bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="admin" className="text-foreground focus:bg-surface-elevated">Admin</SelectItem>
                  <SelectItem value="consultor" className="text-foreground focus:bg-surface-elevated">Consultor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} className="border-border text-foreground">Cancelar</Button>
            <Button onClick={handleInvite} disabled={!nome || !email || saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
