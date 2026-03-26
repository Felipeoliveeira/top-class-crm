import { create } from 'zustand'
import type { Perfil, Role } from '@/types'
import { mockPerfis } from '@/data/mockData'

// TODO: Substituir por Supabase Auth — onAuthStateChange + getSession
// const { data: { session } } = await supabase.auth.getSession()

interface AuthState {
  user: Perfil | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  switchRole: (role: Role) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email: string, _password: string) => {
    set({ isLoading: true })
    // TODO: Substituir por supabase.auth.signInWithPassword({ email, password })
    await new Promise(r => setTimeout(r, 800))

    const found = mockPerfis.find(p => p.email === email && p.status === 'ativo')
    if (found) {
      set({ user: found, isAuthenticated: true, isLoading: false })
      return true
    }
    set({ isLoading: false })
    return false
  },

  logout: () => {
    // TODO: Substituir por supabase.auth.signOut()
    set({ user: null, isAuthenticated: false })
  },

  // Helper for dev: switch between admin and consultor
  switchRole: (role: Role) => {
    const perfil = mockPerfis.find(p => p.role === role && p.status === 'ativo')
    if (perfil) set({ user: perfil, isAuthenticated: true })
  },
}))

export function useAuth() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuthStore()
  return {
    user,
    role: user?.role ?? null,
    isAdmin: user?.role === 'admin',
    isConsultor: user?.role === 'consultor',
    isAuthenticated,
    isLoading,
    login,
    logout,
  }
}
