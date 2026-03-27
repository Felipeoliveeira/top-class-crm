import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TopClassLogo } from '@/components/TopClassLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { Loader2 } from 'lucide-react'

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/definir-senha`,
    })
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center gradient-brand p-4">
      <Card className="w-full max-w-md border-border bg-card shadow-2xl">
        <CardContent className="p-8">
          <div className="mb-8 flex justify-center">
            <TopClassLogo size="lg" variant="full" />
          </div>

          <h2 className="text-xl font-bold text-foreground mb-2">Recuperar senha</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Informe seu e-mail para receber um link de redefinição de senha.
          </p>

          {sent ? (
            <div className="rounded-lg bg-success/10 border border-success/20 p-4 text-center">
              <p className="text-sm text-foreground">
                Se este e-mail estiver cadastrado, você receberá um link em breve.
              </p>
              <Link to="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
                Voltar ao login
              </Link>
            </div>
          ) : (
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
                  className="bg-background border-border"
                />
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar link
              </Button>
              <p className="text-center">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Voltar ao login</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
