import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { AppSidebar } from './AppSidebar'
import { AppHeader } from './AppHeader'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

const STATUS_CHECK_INTERVAL_MS = 30_000

export function AppLayout() {
  const { isAuthenticated, initialize, initialized, checkActiveStatus } = useAuth()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(checkActiveStatus, STATUS_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isAuthenticated, checkActiveStatus])

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <AppHeader />
        <main className="flex-1 p-4 md:p-6 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
