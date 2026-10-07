import { Suspense } from 'react'
import { PageLoader } from '@/components/PageLoader'
import { SkipLink } from '@/components/SkipLink'
import type { ReactNode } from 'react'
import { Link, Outlet, ScrollRestoration } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'

/** Layout sobrio para login/registro: sin distracciones, centrado y cómodo en móvil. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-subtle">
      <SkipLink />
      <header className="container-page flex h-16 items-center md:h-20">
        <Link to="/" aria-label="Barmap, ir al inicio">
          <Logo />
        </Link>
      </header>
      <main id="contenido" tabIndex={-1} className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 outline-none md:items-center md:pt-0">
        <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
          <ScrollRestoration />
      </main>
    </div>
  )
}

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="w-full max-w-md animate-fade-up">
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm md:p-8">
        <h1 className="text-[28px] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-fg-muted">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </div>
      {footer && <div className="mt-5 text-center text-[15px] text-fg-muted">{footer}</div>}
    </div>
  )
}
