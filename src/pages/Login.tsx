import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopClassLogo } from '@/components/TopClassLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated) {
    navigate('/dashboard', { replace: true })
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await login(email, password)
    if (success) {
      toast.success('Login realizado com sucesso!')
      navigate('/dashboard')
    } else {
      toast.error('Credenciais inválidas')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center gradient-brand p-4">
      <Card className="w-full max-w-md border-border bg-card shadow-2xl">
        <CardContent className="p-8">
          <div className="mb-8 flex justify-center">
            <TopClassLogo size="lg" variant="full" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-background border-border focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="bg-background border-border focus:ring-primary"
              />
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Entrar
            </Button>

            <p className="text-center">
              <a href="/recuperar-senha" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Esqueci minha senha
              </a>
            </p>
          </form>

          <div className="mt-6 border-t border-border pt-4">
            <p className="text-center text-xs text-muted-foreground mb-3">Acesso rápido (demo):</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 border-border text-foreground hover:bg-surface-elevated text-xs"
                onClick={async () => {
                  const ok = await login('rodrigo@topclass.com.br', 'admin')
                  if (ok) { toast.success('Login como Admin'); navigate('/dashboard') }
                }}
              >
                Admin
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 border-border text-foreground hover:bg-surface-elevated text-xs"
                onClick={async () => {
                  const ok = await login('ana.paula@topclass.com.br', 'consultor')
                  if (ok) { toast.success('Login como Consultor'); navigate('/dashboard') }
                }}
              >
                Consultor
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
