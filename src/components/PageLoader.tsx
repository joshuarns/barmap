import { Spinner } from '@/components/ui'

/** Mientras se descarga el fragmento de una página (carga diferida). */
export function PageLoader() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center text-fg-muted" role="status" aria-label="Cargando">
      <Spinner className="size-6" />
    </div>
  )
}
