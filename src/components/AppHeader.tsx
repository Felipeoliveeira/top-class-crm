import { Menu } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useLocation, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { TopClassLogo } from './TopClassLogo'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Columns, Users, UserCog } from 'lucide-react'

const breadcrumbMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/pipeline': 'Pipeline',
  '/leads': 'Leads',
  '/admin/usuarios': 'Usuários',
}

export function AppHeader() {
  const { user, isAdmin, logout } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const initials = user?.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'TC'
  const currentPage = breadcrumbMap[location.pathname] || (location.pathname.startsWith('/leads/') ? 'Detalhe do Lead' : 'CRM')

  const adminNav = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Columns, label: 'Pipeline', path: '/pipeline' },
    { icon: Users, label: 'Leads', path: '/leads' },
    { icon: UserCog, label: 'Usuários', path: '/admin/usuarios' },
  ]
  const consultorNav = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Columns, label: 'Pipeline', path: '/pipeline' },
    { icon: Users, label: 'Meus Leads', path: '/leads' },
  ]
  const nav = isAdmin ? adminNav : consultorNav

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-sidebar px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">{currentPage}</span>
          </div>
        </div>

        <div className="flex items-center gap-3" />
      </header>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-sidebar p-4 space-y-4">
            <TopClassLogo size="sm" variant="full" />
            <nav className="space-y-1 mt-6">
              {nav.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                    location.pathname === item.path ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
