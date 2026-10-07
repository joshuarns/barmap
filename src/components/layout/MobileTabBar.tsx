import { NavLink } from 'react-router-dom'
import { Heart, Home, Search, UserRound } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSession } from '@/features/auth/session'


/** Navegación inferior en móvil: zona del pulgar, siempre accesible. */
export function MobileTabBar() {
  const { user } = useSession()
  const accountTab = !user
    ? { to: '/entrar', label: 'Entrar' }
    : user.role === 'admin'
      ? { to: '/admin', label: 'Admin' }
      : user.role === 'owner'
        ? { to: '/panel', label: 'Mi panel' }
        : { to: '/cuenta', label: 'Cuenta' }
  const tabs = [
    { to: '/', label: 'Inicio', icon: Home, end: true },
    { to: '/explorar', label: 'Explorar', icon: Search },
    { to: '/favoritos', label: 'Favoritos', icon: Heart },
    { ...accountTab, icon: UserRound },
  ]
  return (
    <nav aria-label="Navegación móvil" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur-md md:hidden">
      <ul className="grid grid-cols-4">
        {tabs.map(({ to, label, icon: Icon, ...rest }) => (
          <li key={label}>
            <NavLink
              to={to}
              end={'end' in rest ? rest.end : undefined}
              className={({ isActive }) =>
                cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors', isActive ? 'text-brand-600' : 'text-fg-muted')
              }
            >
              <Icon className="size-6" strokeWidth={1.75} aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
