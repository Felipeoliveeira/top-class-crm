import { useState, useEffect, useRef } from 'react'
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

function tokenTypeFromHash(hash: string): TokenType {
  return hash.includes('type=invite') ? 'invite' : 'recovery'
}

/** Lê access_token / refresh_token do fragmento (#) ou query (alguns fluxos). */
function getTokensFromUrl(): { access_token: string | null; refresh_token: string | null } {
  const url = new URL(window.location.href)
  const fromHash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const accessFromHash = fromHash.get('access_token')
  const refreshFromHash = fromHash.get('refresh_token')
  if (accessFromHash && refreshFromHash) {
    return { access_token: accessFromHash, refresh_token: refreshFromHash }
  }
  return {
    access_token: url.searchParams.get('access_token'),
    refresh_token: url.searchParams.get('refresh_token'),
  }
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
  const [tokenType, setTokenType] = useState<TokenType>(() =>
    tokenTypeFromHash(typeof window !== 'undefined' ? window.location.hash : ''),
  )
  const navigate = useNavigate()
  const initOnce = useRef(false)

  const { title, subtitle } = PAGE_CONTENT[tokenType]
  const isValid = password.length >= 8 && password === confirm

  useEffect(() => {
    if (initOnce.current) return
    initOnce.current = true

    const run = async () => {
      setTokenType(tokenTypeFromHash(window.location.hash))

      if (hasErrorInUrl()) {
        setPageState('expired')
        return
      }

      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const { access_token, refresh_token } = getTokensFromUrl()

      let sessionEstablished = false

      if (code) {
        const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code)
        if (!codeErr) {
          sessionEstablished = true
          url.searchParams.delete('code')
          window.history.replaceState({}, '', `${url.pathname}${url.hash}`)
        } else if (!access_token || !refresh_token) {
          setPageState('expired')
          return
        }
      }

      if (!sessionEstablished && access_token && refresh_token) {
        await supabase.auth.signOut({ scope: 'local' })
        const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token })
        if (setErr) {
          setPageState('expired')
          return
        }
        window.history.replaceState({}, '', url.pathname)
      }

      const { data: { session }, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr || !session) {
        setPageState('expired')
        return
      }

      setPageState('ready')
    }

    void run()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    let errorMessage: string | null = null
    try {
      const { data: sessionCheck } = await supabase.auth.getSession()
      if (!sessionCheck.session) {
        errorMessage = 'Sessão não encontrada. Abra o link do e-mail novamente.'
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) {
          errorMessage = error.message
        } else {
          await supabase.auth.signOut()
          navigate('/login', { replace: true, state: { fromPasswordSetup: true } })
        }
      }
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : 'Erro ao definir senha. Tente novamente.'
    } finally {
      setLoading(false)
    }

    if (errorMessage) {
      const msg = errorMessage.toLowerCase()
      if (
        msg.includes('expired') ||
        msg.includes('invalid') ||
        msg.includes('token') ||
        msg.includes('session')
      ) {
        setPageState('expired')
      } else {
        toast.error(errorMessage)
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
