import { useRef, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { Spinner, EmptyState, buttonVariants } from '@/components/ui'
import { useSession } from '@/features/auth/session'
import type { UserRole } from '@/types/domain'

function FullPageSpinner() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center text-fg-muted" aria-busy>
      <Spinner className="size-6" />
    </div>
  )
}

/**
 * Guardas de UI. Evitan mostrar pantallas que no corresponden, pero NO son
 * la seguridad: cada endpoint vuelve a validar sesión, rol y estado.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useSession()
  const location = useLocation()
  if (isLoading) return <FullPageSpinner />
  if (!user) return <Navigate to={`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return children
}

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, isLoading } = useSession()
  const location = useLocation()
  if (isLoading) return <FullPageSpinner />
  if (!user) return <Navigate to={`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (roles.includes(user.role)) return children
  // Un visitante que intenta entrar al panel va al flujo de solicitud.
  if (roles.includes('owner') && user.role === 'visitor') return <Navigate to="/registra-tu-bar" replace />
  if (roles.includes('owner') && user.role === 'admin') return <Navigate to="/admin" replace />
  return (
    <div className="container-page py-20">
      <EmptyState
        icon={ShieldX}
        tone="danger"
        title="No tienes acceso a esta sección"
        description="Tu cuenta no tiene permisos para ver esta página."
        action={<Link to="/" className={buttonVariants({ variant: 'outline' })}>Volver al inicio</Link>}
      />
    </div>
  )
}

/**
 * Para /entrar y /registro: si YA había sesión al llegar, no tiene sentido
 * mostrarlas. Se decide una sola vez; así no interfiere con la navegación
 * que hace el propio formulario tras iniciar sesión o registrarse.
 */
export function RedirectIfAuthenticated({ children, to }: { children: ReactNode; to: string }) {
  const { user, isLoading } = useSession()
  const hadSession = useRef<boolean | null>(null)
  if (isLoading) return <FullPageSpinner />
  if (hadSession.current === null) hadSession.current = !!user
  if (hadSession.current) return <Navigate to={to} replace />
  return children
}
