import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, RefreshCw } from 'lucide-react'
import type { BarSummary } from '@/types/api'
import { Button } from '@/components/ui'
import { useFavoriteAction } from '@/features/engagement'
import { BarCard, BarCardSkeleton } from './BarCard'

interface BarRailProps {
  title: string
  subtitle?: string
  bars?: BarSummary[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  seeAllHref?: string
  empty?: ReactNode
}

/**
 * Sección de tarjetas: carrusel horizontal con snap en móvil y cuadrícula
 * de 4 columnas en escritorio.
 */
export function BarRail({ title, subtitle, bars, isLoading, isError, onRetry, seeAllHref, empty }: BarRailProps) {
  const fav = useFavoriteAction()
  return (
    <section className="mt-12 md:mt-16">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-bold leading-tight md:text-[28px]">{title}</h2>
          {subtitle && <p className="mt-1 text-[15px] text-fg-muted">{subtitle}</p>}
        </div>
        {seeAllHref && (
          <Link to={seeAllHref} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-fg underline-offset-4 hover:underline">
            Ver todos <ChevronRight className="size-4" />
          </Link>
        )}
      </div>

      {isError ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-subtle p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] text-fg-muted">No pudimos cargar esta sección.</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw /> Reintentar
          </Button>
        </div>
      ) : !isLoading && bars?.length === 0 ? (
        empty
      ) : (
        <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="w-[78%] shrink-0 snap-start sm:w-[45%] md:w-auto">
                  <BarCardSkeleton />
                </div>
              ))
            : bars!.map((bar) => (
                <div key={bar.id} className="w-[78%] shrink-0 snap-start sm:w-[45%] md:w-auto">
                  <BarCard bar={bar} isFavorite={fav.isFavorite(bar.id)} onToggleFavorite={fav.toggle} />
                </div>
              ))}
        </div>
      )}
    </section>
  )
}
