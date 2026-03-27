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
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  initialize: () => Promise<void>
}

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

  initialize: async () => {
    if (get().initialized) return

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const perfil = await fetchPerfil(session.user.id)
      if (perfil && perfil.status === 'ativo') {
        set({ user: perfil, supabaseUser: session.user, isAuthenticated: true, initialized: true })
      } else {
        set({ initialized: true })
      }
    } else {
      set({ initialized: true })
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        set({ user: null, supabaseUser: null, isAuthenticated: false })
        return
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const perfil = await fetchPerfil(session.user.id)
        if (perfil && perfil.status === 'ativo') {
          set({ user: perfil, supabaseUser: session.user, isAuthenticated: true })
        }
      }
    })
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      set({ isLoading: false })
      return false
    }
    const perfil = await fetchPerfil(data.user.id)
    if (!perfil || perfil.status !== 'ativo') {
      await supabase.auth.signOut()
      set({ isLoading: false })
      return false
    }
    set({ user: perfil, supabaseUser: data.user, isAuthenticated: true, isLoading: false })
    return true
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, supabaseUser: null, isAuthenticated: false })
  },
}))

export function useAuth() {
  const { user, isAuthenticated, isLoading, login, logout, initialize, initialized } = useAuthStore()
  return {
    user,
    role: user?.role ?? null,
    isAdmin: user?.role === 'admin',
    isConsultor: user?.role === 'consultor',
    isAuthenticated,
    isLoading,
    initialized,
    login,
    logout,
    initialize,
  }
}
