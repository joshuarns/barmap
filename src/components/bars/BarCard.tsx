import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, ChevronLeft, ChevronRight, Heart, MapPin } from 'lucide-react'
import { LogoMark } from '@/components/brand/Logo'
import type { BarSummary } from '@/types/domain'
import { cn } from '@/lib/cn'
import { formatDistance } from '@/lib/format'
import { Skeleton } from '@/components/ui'
import { PriceRange } from './PriceRange'

interface BarCardProps {
  bar: BarSummary
  isFavorite?: boolean
  onToggleFavorite?: (bar: BarSummary) => void
  /** Sincroniza el resaltado con el mapa. */
  onHoverChange?: (id: string | null) => void
  highlighted?: boolean
  className?: string
}

export function BarCard({ bar, isFavorite, onToggleFavorite, onHoverChange, highlighted, className }: BarCardProps) {
  const images = bar.imageUrls?.length ? bar.imageUrls : bar.coverUrl ? [bar.coverUrl] : []
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)

  const go = (dir: 1 | -1) => {
    const next = Math.min(Math.max(index + dir, 0), images.length - 1)
    track.current?.scrollTo({ left: next * track.current.clientWidth, behavior: 'smooth' })
    setIndex(next)
  }

  return (
    <article
      className={cn('group relative', className)}
      onMouseEnter={onHoverChange && (() => onHoverChange(bar.id))}
      onMouseLeave={onHoverChange && (() => onHoverChange(null))}
    >
      <div className={cn('relative aspect-[20/19] overflow-hidden rounded-2xl bg-ink-100 transition-shadow', highlighted && 'ring-2 ring-ink-900 ring-offset-2')}>
        {images.length === 0 && (
          <div className="flex h-full items-center justify-center text-ink-300">
            <LogoMark className="size-12" />
          </div>
        )}
        <div
          ref={track}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="scrollbar-none flex h-full snap-x snap-mandatory overflow-x-auto"
        >
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={i === 0 ? `Fotografía de ${bar.name}` : ''}
              loading="lazy"
              className="h-full w-full shrink-0 snap-center object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ))}
        </div>

        {bar.isOpenNow !== undefined && (
          <span className="absolute left-3 top-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-white/95 px-2.5 text-xs font-bold text-ink-900 shadow-sm backdrop-blur">
            <span className={cn('size-2 rounded-full', bar.isOpenNow ? 'bg-success-600' : 'bg-ink-400')} />
            {bar.isOpenNow ? `Abierto${bar.closesAt ? ` · cierra ${bar.closesAt}` : ''}` : 'Cerrado'}
          </span>
        )}

        {onToggleFavorite && (
          <button
            type="button"
            onClick={() => onToggleFavorite(bar)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Quitar ${bar.name} de favoritos` : `Guardar ${bar.name} en favoritos`}
            className="absolute right-2 top-2 z-10 flex size-10 items-center justify-center rounded-full transition-transform active:scale-90"
          >
            <Heart
              className={cn('size-6 drop-shadow-[0_1px_2px_rgb(0_0_0/0.35)] transition-colors', isFavorite ? 'fill-brand-500 text-white' : 'fill-ink-900/40 text-white')}
              strokeWidth={2}
            />
          </button>
        )}

        {images.length > 1 && (
          <>
            <CarouselArrow side="left" hidden={index === 0} onClick={() => go(-1)} />
            <CarouselArrow side="right" hidden={index === images.length - 1} onClick={() => go(1)} />
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
              {images.map((_, i) => (
                <span key={i} className={cn('size-1.5 rounded-full bg-white transition-opacity', i === index ? 'opacity-100' : 'opacity-55')} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1 font-sans text-[15px] font-bold tracking-normal text-fg">
            <Link to={`/bares/${bar.slug}`} className="truncate after:absolute after:inset-0 after:z-0 focus-visible:outline-none">
              {bar.name}
            </Link>
            {bar.isVerified && <BadgeCheck className="size-4 shrink-0 text-info-600" aria-label="Verificado" />}
          </h3>
          <p className="truncate text-[15px] text-fg-muted">
            {bar.category} · {bar.neighborhood}
          </p>
        </div>
        <PriceRange value={bar.priceRange} className="shrink-0 text-sm" />
      </div>
      {bar.distanceMeters !== undefined && (
        <p className="mt-0.5 flex items-center gap-1 text-[15px] text-fg-muted">
          <MapPin className="size-3.5" aria-hidden />a {formatDistance(bar.distanceMeters)}
        </p>
      )}
    </article>
  )
}

function CarouselArrow({ side, hidden, onClick }: { side: 'left' | 'right'; hidden: boolean; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      onClick={onClick}
      className={cn(
        'absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink-900 opacity-0 shadow-md transition-all hover:scale-105 group-hover:opacity-100 md:flex',
        side === 'left' ? 'left-3' : 'right-3',
        hidden && 'pointer-events-none !opacity-0',
      )}
    >
      <Icon className="size-4" strokeWidth={2.5} />
    </button>
  )
}

export function BarCardSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="aspect-[20/19] rounded-2xl" />
      <div className="mt-3 flex justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-4 w-10" />
      </div>
    </div>
  )
}
