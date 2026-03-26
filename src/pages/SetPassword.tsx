import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopClassLogo } from '@/components/TopClassLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // TODO: Check token from URL hash for recovery vs invite
  const isInvite = window.location.hash.includes('type=invite')
  const title = isInvite ? 'Crie sua senha' : 'Redefina sua senha'

  const valid = password.length >= 8 && password === confirm

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setLoading(true)
    // TODO: Substituir por supabase.auth.updateUser({ password })
    await new Promise(r => setTimeout(r, 1000))
    setLoading(false)
    toast.success('Senha definida com sucesso!')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center gradient-brand p-4">
      <Card className="w-full max-w-md border-border bg-card shadow-2xl">
        <CardContent className="p-8">
          <div className="mb-8 flex justify-center">
            <TopClassLogo size="lg" variant="full" />
          </div>

          <h2 className="text-xl font-bold text-foreground mb-6">{title}</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-foreground">Nova Senha</Label>
              <Input
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="bg-background border-border"
              />
              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-destructive">Mínimo de 8 caracteres</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Confirmar Senha</Label>
              <Input
                type="password"
                placeholder="Repita a senha"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="bg-background border-border"
              />
              {confirm.length > 0 && password !== confirm && (
                <p className="text-xs text-destructive">As senhas não coincidem</p>
              )}
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={!valid || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
