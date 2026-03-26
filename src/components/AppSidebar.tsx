import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Columns, Users, UserCog, LogOut } from 'lucide-react'
import { TopClassLogo } from '@/components/TopClassLogo'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

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

export function AppSidebar() {
  const { user, isAdmin, logout } = useAuth()
  const location = useLocation()
  const nav = isAdmin ? adminNav : consultorNav

  const initials = user?.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'TC'

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
      <div className="p-6">
        <TopClassLogo size="sm" variant="full" />
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {nav.map((item) => {
          const active = location.pathname === item.path
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/20 text-primary text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.nome_completo}</p>
            <StatusBadge status={user?.role || 'consultor'} className="mt-0.5" />
          </div>
          <button onClick={logout} className="text-muted-foreground hover:text-foreground transition-colors" title="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
