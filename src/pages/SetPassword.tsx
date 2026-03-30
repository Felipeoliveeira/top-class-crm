import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { TopClassLogo } from '@/components/TopClassLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Loader2, AlertTriangle } from 'lucide-react'

type PageState = 'loading' | 'ready' | 'expired'
type TokenType = 'invite' | 'recovery'

function detectTokenType(): TokenType {
  const hash = window.location.hash
  if (hash.includes('type=invite')) return 'invite'
  return 'recovery'
}

function hasErrorInUrl(): boolean {
  const hash = window.location.hash
  return hash.includes('error=') || hash.includes('error_code=')
}

const PAGE_CONTENT: Record<TokenType, { title: string; subtitle: string }> = {
  invite: {
    title: 'Crie sua senha',
    subtitle: 'Bem-vindo ao CRM Top Class! Defina uma senha para acessar o sistema.',
  },
  recovery: {
    title: 'Redefina sua senha',
    subtitle: 'Digite sua nova senha abaixo.',
  },
}

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageState, setPageState] = useState<PageState>('loading')
  const navigate = useNavigate()

  const tokenType = detectTokenType()
  const { title, subtitle } = PAGE_CONTENT[tokenType]
  const isValid = password.length >= 8 && password === confirm

  useEffect(() => {
    if (hasErrorInUrl()) {
      setPageState('expired')
      return
    }

    let resolved = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolved) return

      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        resolved = true
        setPageState(session ? 'ready' : 'expired')
        return
      }

      if (event === 'INITIAL_SESSION') {
        resolved = true
        setPageState(session ? 'ready' : 'expired')
      }
    })

    const timeout = setTimeout(async () => {
      if (resolved) return
      resolved = true
      const { data: { session } } = await supabase.auth.getSession()
      setPageState(session ? 'ready' : 'expired')
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    let errorMessage: string | null = null
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        errorMessage = error.message
      } else {
        toast.success('Senha definida com sucesso!')
        await supabase.auth.signOut()
        navigate('/login')
      }
    } catch {
      errorMessage = 'Erro ao definir senha. Tente novamente.'
    } finally {
      setLoading(false)
    }

    if (errorMessage) {
      const msg = errorMessage.toLowerCase()
      if (msg.includes('expired') || msg.includes('invalid') || msg.includes('token')) {
        setPageState('expired')
      } else {
        toast.error('Erro ao definir senha. Tente novamente.')
      }
      return
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center gradient-brand p-4">
      <Card className="w-full max-w-md border-border bg-card shadow-2xl">
        <CardContent className="p-8">
          <div className="mb-8 flex justify-center">
            <TopClassLogo size="lg" variant="full" />
          </div>

          {pageState === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validando link de acesso...</p>
            </div>
          )}

          {pageState === 'expired' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Link expirado ou inválido</h2>
              <p className="text-sm text-muted-foreground text-center">
                Este link de acesso não é mais válido. Solicite um novo link para continuar.
              </p>
              <Link
                to="/recuperar-senha"
                className="mt-2 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Solicitar novo link
              </Link>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Voltar ao login
              </Link>
            </div>
          )}

          {pageState === 'ready' && (
            <>
              <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
              <p className="text-sm text-muted-foreground mb-6">{subtitle}</p>

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

                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={!isValid || loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar senha
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
