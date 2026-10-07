import { Suspense } from 'react'
import { PageLoader } from '@/components/PageLoader'
import { SkipLink } from '@/components/SkipLink'
import { Outlet, ScrollRestoration, useMatches } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { MobileTabBar } from './MobileTabBar'

export interface RouteHandle {
  /** Oculta la barra inferior en móvil (p. ej. el detalle tiene su propia barra de acciones). */
  hideTabBar?: boolean
}

export function PublicLayout() {
  const hideTabBar = useMatches().some((m) => (m.handle as RouteHandle | undefined)?.hideTabBar)
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <Navbar />
      <main id="contenido" tabIndex={-1} className="flex-1 outline-none">
        <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
          <ScrollRestoration />
      </main>
      <Footer />
      {!hideTabBar && <MobileTabBar />}
    </div>
  )
}
