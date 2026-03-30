import { create } from 'zustand'
import { supabase } from '@/integrations/supabase/client'
import type { User } from '@supabase/supabase-js'

interface Perfil {
  id: string
  nome_completo: string
  email: string
  role: 'admin' | 'consultor'
  status: 'ativo' | 'inativo'
  ultimo_acesso: string | null
  created_at: string
}

interface AuthState {
  user: Perfil | null
  supabaseUser: User | null
  isAuthenticated: boolean
  isLoading: boolean
  initialized: boolean
  hasExplicitLogin: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  initialize: () => Promise<void>
  checkActiveStatus: () => Promise<void>
}

const MIN_LOGIN_DELAY_MS = 800

async function fetchPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome_completo, email, role, status, ultimo_acesso, created_at')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return data as Perfil
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  supabaseUser: null,
  isAuthenticated: false,
  isLoading: false,
  initialized: false,
  hasExplicitLogin: false,

  initialize: async () => {
    if (get().initialized) return

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      // Hardening: nunca reaproveitar sessão pré-existente ao abrir o CRM.
      // O usuário deve autenticar explicitamente com e-mail e senha.
      await supabase.auth.signOut()
    }
    set({ user: null, supabaseUser: null, isAuthenticated: false, initialized: true, hasExplicitLogin: false })

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        set({ user: null, supabaseUser: null, isAuthenticated: false, hasExplicitLogin: false })
        return
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!get().hasExplicitLogin) {
          await supabase.auth.signOut()
          set({ user: null, supabaseUser: null, isAuthenticated: false, hasExplicitLogin: false })
          return
        }
        const perfil = await fetchPerfil(session.user.id)
        if (perfil && perfil.status === 'ativo') {
          set({ user: perfil, supabaseUser: session.user, isAuthenticated: true })
        } else {
          await supabase.auth.signOut()
          set({ user: null, supabaseUser: null, isAuthenticated: false, hasExplicitLogin: false })
        }
      }
    })
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, hasExplicitLogin: true })
    const start = Date.now()
    let success = false

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error && data.user) {
        const perfil = await fetchPerfil(data.user.id)
        if (perfil && perfil.status === 'ativo') {
          set({ user: perfil, supabaseUser: data.user, isAuthenticated: true })
          success = true
        } else {
          await supabase.auth.signOut()
          set({ hasExplicitLogin: false })
        }
      }
    } catch {
      // Network/unexpected errors swallowed to prevent info leakage
      set({ hasExplicitLogin: false })
    }

    // Tempo mínimo de resposta impede inferência por timing (S-2.1.1)
    const elapsed = Date.now() - start
    if (elapsed < MIN_LOGIN_DELAY_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_LOGIN_DELAY_MS - elapsed))
    }

    if (!success) {
      set({ hasExplicitLogin: false })
    }
    set({ isLoading: false })
    return success
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, supabaseUser: null, isAuthenticated: false, hasExplicitLogin: false })
  },

  checkActiveStatus: async () => {
    const currentUser = get().supabaseUser
    if (!currentUser) return

    const perfil = await fetchPerfil(currentUser.id)
    if (!perfil || perfil.status !== 'ativo') {
      await supabase.auth.signOut()
      set({ user: null, supabaseUser: null, isAuthenticated: false, hasExplicitLogin: false })
    } else {
      set({ user: perfil })
    }
  },
}))

export function useAuth() {
  const store = useAuthStore()
  return {
    user: store.user,
    role: store.user?.role ?? null,
    isAdmin: store.user?.role === 'admin',
    isConsultor: store.user?.role === 'consultor',
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    initialized: store.initialized,
    login: store.login,
    logout: store.logout,
    initialize: store.initialize,
    checkActiveStatus: store.checkActiveStatus,
  }
}
