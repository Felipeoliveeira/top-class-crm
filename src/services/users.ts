import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import type { Perfil, Role } from '@/types'

/** Corpo JSON da Edge Function (erro ou sucesso). */
interface InviteFunctionBody {
  error?: string
  message?: string
  success?: boolean
}

/**
 * Em 4xx/5xx o cliente define `data: null` e `error: FunctionsHttpError`;
 * o JSON `{ error: "..." }` retornado pela função está em `error.context` (Response).
 */
async function throwIfInviteFailed(
  result: Awaited<ReturnType<typeof supabase.functions.invoke>>,
  fallback: string,
): Promise<void> {
  const body = result.data as InviteFunctionBody | null
  if (body?.error) {
    throw new Error(body.error)
  }
  if (!result.error) return

  if (result.error instanceof FunctionsHttpError && result.error.context) {
    try {
      const parsed = (await result.error.context.json()) as InviteFunctionBody
      if (parsed?.error) throw new Error(parsed.error)
    } catch (e) {
      if (e instanceof Error && !(e instanceof SyntaxError)) {
        throw e
      }
    }
  }

  throw new Error(result.error.message ?? fallback)
}

export async function fetchPerfisForAdmin(): Promise<Perfil[]> {
  const { data, error } = await supabase.from('perfis').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Perfil[]) || []
}

export interface InviteUserPayload {
  email: string
  nome_completo: string
  role: Role
}

export async function invokeInviteUser(payload: InviteUserPayload): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Faça login novamente.')

  const response = await supabase.functions.invoke('invite-user', {
    body: {
      email: payload.email.trim().toLowerCase(),
      nome_completo: payload.nome_completo.trim(),
      role: payload.role,
    },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  await throwIfInviteFailed(response, 'Erro ao enviar convite')
}

export async function invokeResendInvite(email: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Faça login novamente.')

  const response = await supabase.functions.invoke('invite-user', {
    body: { resend: true, email: email.trim().toLowerCase() },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  await throwIfInviteFailed(response, 'Erro ao reenviar convite')
}

export async function updatePerfilStatus(id: string, status: 'ativo' | 'inativo'): Promise<void> {
  const { error } = await supabase.from('perfis').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}
