import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'

const INACTIVITY_TIMEOUT_MS = 40 * 60 * 1_000 // 40 minutos
const WARNING_BEFORE_MS = 2 * 60 * 1_000       // aviso 2 minutos antes

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
  'wheel',
]

/**
 * Dispara logout automático após INACTIVITY_TIMEOUT_MS de inatividade.
 * Um aviso via toast é exibido WARNING_BEFORE_MS antes do logout.
 * Qualquer interação do usuário reseta ambos os timers.
 */
export function useInactivityTimeout(onTimeout: () => void, enabled: boolean) {
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningToastIdRef = useRef<string | number | null>(null)

  const clearTimers = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    // Descarta o toast de aviso se ainda estiver visível
    if (warningToastIdRef.current !== null) {
      toast.dismiss(warningToastIdRef.current)
      warningToastIdRef.current = null
    }
  }, [])

  const resetTimers = useCallback(() => {
    clearTimers()

    warningTimerRef.current = setTimeout(() => {
      warningToastIdRef.current = toast.warning('Sessão expirando em 2 minutos', {
        description: 'Interaja com o sistema para manter sua sessão ativa.',
        duration: WARNING_BEFORE_MS,
      })
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS)

    logoutTimerRef.current = setTimeout(() => {
      toast.info('Sessão encerrada por inatividade.')
      onTimeout()
    }, INACTIVITY_TIMEOUT_MS)
  }, [clearTimers, onTimeout])

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      return
    }

    resetTimers()

    const handleActivity = () => resetTimers()

    ACTIVITY_EVENTS.forEach(event =>
      window.addEventListener(event, handleActivity, { passive: true })
    )

    return () => {
      clearTimers()
      ACTIVITY_EVENTS.forEach(event =>
        window.removeEventListener(event, handleActivity)
      )
    }
  }, [enabled, resetTimers, clearTimers])
}
