import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Button, EmptyState, buttonVariants } from '@/components/ui'

/**
 * Error de ruta. Caso típico en producción: tras un despliegue nuevo, una
 * pestaña abierta intenta cargar un fragmento JS que ya no existe → se ofrece recargar.
 */
export default function RouteError() {
  const error = useRouteError()
  const chunk = error instanceof Error && /dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(error.message)
  if (import.meta.env.DEV) console.error(error)
  return (
    <div className="flex min-h-dvh flex-col bg-subtle">
      <header className="container-page flex h-16 items-center"><Link to="/"><Logo /></Link></header>
      <main className="flex flex-1 items-center justify-center px-4">
        <EmptyState
          icon={TriangleAlert}
          tone="danger"
          title={chunk ? 'Hay una versión nueva de Barmap' : isRouteErrorResponse(error) && error.status === 404 ? 'Página no encontrada' : 'Algo salió mal'}
          description={chunk ? 'Recarga la página para continuar.' : 'Ocurrió un error inesperado. Intenta recargar la página o vuelve al inicio.'}
          action={
            <>
              <Button onClick={() => window.location.reload()}><RefreshCw /> Recargar</Button>
              <Link to="/" className={buttonVariants({ variant: 'outline' })}>Ir al inicio</Link>
            </>
          }
        />
      </main>
    </div>
  )
}
