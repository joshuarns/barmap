import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, UserRound } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Avatar } from '@/components/ui'
import { firstName, useLogout, useSession } from '@/features/auth/session'
import { NotificationBell } from './NotificationBell'
import { cn } from '@/lib/cn'

export function Navbar() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useSession()
  const logout = useLogout()
  const onExplore = location.pathname === '/explorar'
  const mapView = onExplore && new URLSearchParams(location.search).get('vista') === 'mapa'

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4 md:h-20">
        <Link to="/" aria-label="Barmap, ir al inicio">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
          {[
            { to: '/explorar', label: 'Explorar', active: onExplore && !mapView },
            { to: '/explorar?vista=mapa', label: 'Mapa', active: mapView },
          ].map((l) => (
            <Link
              key={l.label}
              to={l.to}
              aria-current={l.active ? 'page' : undefined}
              className={cn('rounded-full px-4 py-2.5 text-[15px] font-semibold transition-colors hover:bg-ink-50 hover:text-fg', l.active ? 'text-fg' : 'text-fg-muted')}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to={user?.role === 'admin' ? '/admin' : user?.role === 'owner' ? '/panel' : '/registra-tu-bar'}
            className="hidden rounded-full px-4 py-2.5 text-[15px] font-semibold text-fg transition-colors hover:bg-ink-50 md:inline-flex"
          >
            {user?.role === 'admin' ? 'Administración' : user?.role === 'owner' ? 'Mi panel' : 'Registra tu bar'}
          </Link>
          {user && <NotificationBell />}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-haspopup="menu"
              aria-label="Menú de cuenta"
              className={cn(
                'flex h-11 items-center gap-2.5 rounded-full border border-line-strong pl-3.5 pr-1.5 transition-shadow hover:shadow-md',
                open && 'shadow-md',
              )}
            >
              <Menu className="size-4 text-fg" strokeWidth={2.5} />
              {user ? (
                <Avatar name={user.name} size="sm" />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-full bg-ink-600 text-white">
                  <UserRound className="size-4" />
                </span>
              )}
            </button>
            {open && (
              <div role="menu" className="absolute right-0 top-full mt-2 w-60 origin-top-right animate-fade-up overflow-hidden rounded-2xl border border-line bg-surface py-2 shadow-lg">
                {user ? (
                  <>
                    <div className="px-4 pb-2 pt-1">
                      <p className="font-semibold">{firstName(user.name)}</p>
                      <p className="truncate text-sm text-fg-muted">{user.email}</p>
                    </div>
                    <div className="my-2 h-px bg-line" />
                    {user.role === 'admin' && <MenuLink to="/admin" strong onClick={() => setOpen(false)}>Administración</MenuLink>}
                    {user.role === 'owner' && <MenuLink to="/panel" strong onClick={() => setOpen(false)}>Mi panel</MenuLink>}
                    <MenuLink to="/favoritos" onClick={() => setOpen(false)}>Favoritos</MenuLink>
                    <MenuLink to={user.role === 'owner' ? '/panel/cuenta' : '/cuenta'} onClick={() => setOpen(false)}>Mi cuenta</MenuLink>
                    {user.role === 'visitor' && (
                      <MenuLink to="/registra-tu-bar" onClick={() => setOpen(false)}>
                        {user.application?.status === 'pending' ? 'Mi solicitud' : 'Registra tu bar'}
                      </MenuLink>
                    )}
                    <div className="my-2 h-px bg-line" />
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        logout.mutate(undefined, { onSettled: () => navigate('/') })
                      }}
                      className="block w-full px-4 py-2.5 text-left text-[15px] text-ink-600 hover:bg-ink-50"
                    >
                      Cerrar sesión
                    </button>
                  </>
                ) : (
                  <>
                    <MenuLink to="/entrar" strong onClick={() => setOpen(false)}>Iniciar sesión</MenuLink>
                    <MenuLink to="/registro" onClick={() => setOpen(false)}>Crear cuenta</MenuLink>
                    <div className="my-2 h-px bg-line" />
                    <MenuLink to="/registra-tu-bar" onClick={() => setOpen(false)}>Registra tu bar</MenuLink>
                    <MenuLink to="/ayuda" onClick={() => setOpen(false)}>Centro de ayuda</MenuLink>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function MenuLink({ to, strong, children, onClick }: { to: string; strong?: boolean; children: string; onClick: () => void }) {
  return (
    <Link role="menuitem" to={to} onClick={onClick} className={cn('block px-4 py-2.5 text-[15px] hover:bg-ink-50', strong ? 'font-semibold text-fg' : 'text-ink-600')}>
      {children}
    </Link>
  )
}
