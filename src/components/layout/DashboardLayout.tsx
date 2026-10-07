import { Suspense } from 'react'
import { PageLoader } from '@/components/PageLoader'
import { SkipLink } from '@/components/SkipLink'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom'
import { ExternalLink, LogOut, Menu, X, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Avatar, Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useLogout } from '@/features/auth/session'
import { NotificationBell } from './NotificationBell'

export interface DashboardNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: number
}

interface DashboardLayoutProps {
  variant: 'owner' | 'admin'
  nav: DashboardNavItem[]
  user: { name: string; email: string }
  /** Insignias por ruta (p. ej. solicitudes pendientes). */
  badges?: Record<string, number | undefined>
}

/**
 * Estructura común para el panel del propietario y el de administración.
 * Mismo lenguaje visual; el admin se distingue con una barra lateral oscura.
 */
export function DashboardLayout({ variant, nav, user, badges }: DashboardLayoutProps) {
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const logout = useLogout()
  const dark = variant === 'admin'

  useEffect(() => setDrawer(false), [location.pathname])

  const renderSidebar = (inDrawer: boolean) => (
    <div className={cn('flex h-full flex-col', dark ? 'bg-ink-900 text-white' : 'bg-surface')}>
      <div className="flex h-16 items-center justify-between px-5 md:h-20">
        <Link to="/" aria-label="Barmap, ir al sitio público">
          <Logo inverted={dark} />
        </Link>
        {inDrawer ? (
          <button type="button" onClick={() => setDrawer(false)} aria-label="Cerrar menú" className={cn('-mr-2 flex size-10 items-center justify-center rounded-full', dark ? 'text-white hover:bg-white/10' : 'hover:bg-ink-50')}>
            <X className="size-5" />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <NotificationBell tone={dark ? 'dark' : 'light'} align="left" />
            <Badge tone={dark ? 'brand' : 'neutral'}>{dark ? 'Admin' : 'Negocios'}</Badge>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Panel">
        {nav.map(({ to, label, icon: Icon, end, badge: staticBadge }) => {
          const badge = badges?.[to] ?? staticBadge
          return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors',
                dark
                  ? isActive ? 'bg-white/10 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white'
                  : isActive ? 'bg-ink-50 text-fg' : 'text-fg-muted hover:bg-ink-50 hover:text-fg',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('size-5', isActive && (dark ? 'text-brand-400' : 'text-brand-600'))} strokeWidth={1.9} aria-hidden />
                <span className="flex-1">{label}</span>
                {badge ? (
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', dark ? 'bg-brand-500 text-white' : 'bg-brand-600 text-white')}>{badge}</span>
                ) : null}
              </>
            )}
          </NavLink>
          )
        })}
      </nav>
      <div className={cn('m-3 flex items-center gap-3 rounded-2xl p-3', dark ? 'bg-white/5' : 'bg-ink-50')}>
        <Avatar name={user.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className={cn('truncate text-xs', dark ? 'text-ink-400' : 'text-fg-muted')}>{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/') })}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', dark ? 'text-ink-300 hover:bg-white/10 hover:text-white' : 'text-fg-muted hover:bg-ink-100 hover:text-fg')}
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh bg-subtle md:grid md:grid-cols-[272px_1fr]">
      <SkipLink />
      <aside className={cn('sticky top-0 hidden h-dvh border-r md:block', dark ? 'border-ink-800' : 'border-line')}>{renderSidebar(false)}</aside>

      {/* Móvil: barra superior + cajón lateral */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur md:hidden">
        <button type="button" onClick={() => setDrawer(true)} aria-label="Abrir menú" className="-ml-2 flex size-10 items-center justify-center rounded-full hover:bg-ink-50">
          <Menu className="size-5" />
        </button>
        <Logo />
        <NotificationBell />
      </header>
      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú del panel">
          <div className="absolute inset-0 bg-ink-900/45" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-xs animate-fade-up shadow-lg">
            {renderSidebar(true)}
          </div>
        </div>
      )}

      <div className="min-w-0">
        <main id="contenido" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 outline-none md:px-8 md:py-10">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
          <ScrollRestoration />
        </main>
      </div>
    </div>
  )
}

/** Encabezado estándar de una página del panel. */
export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-sm font-semibold text-brand-600">{eyebrow}</p>}
        <h1 className="text-[28px] font-bold leading-tight text-fg md:text-[32px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </div>
  )
}

export function PublicSiteLink() {
  return (
    <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
      Ver sitio público <ExternalLink className="size-3.5" />
    </Link>
  )
}
