import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AtSign, BadgeCheck, Flag, Heart, ChevronLeft, Clock, ExternalLink, Globe, MapPin, MapPinOff, Navigation, Phone, Share2,
} from 'lucide-react'
import { BarCard } from '@/components/bars/BarCard'
import { PriceRange, PRICE_RANGE_LABELS } from '@/components/bars/PriceRange'
import { ErrorState } from '@/components/ErrorState'
import { iconFor } from '@/components/icons/registry'
import { Badge, Button, EmptyState, Skeleton, buttonVariants, useToast } from '@/components/ui'
import { useBar } from '@/features/bars/queries'
import { trackEvent, useFavoriteAction } from '@/features/engagement'
import { ReportModal } from '@/features/bar-detail/ReportModal'
import { Gallery } from '@/features/bar-detail/Gallery'
import { barJsonLd, directionsUrl, nextOpening, shareBar, todayIndex } from '@/features/bar-detail/actions'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { DAY_LABELS, type DayOfWeek } from '@/types/domain'
import type { BarDetail as Bar } from '@/types/api'

const LocationMap = lazy(() => import('@/components/map/LocationMap'))

const SOCIAL_LABELS = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', x: 'X' } as const

export default function BarDetail() {
  const { slug = '' } = useParams()
  const { data: bar, isLoading, error, refetch } = useBar(slug)
  const notFound = error instanceof ApiError && error.status === 404

  const jsonLd = useMemo(() => (bar ? barJsonLd(bar) : undefined), [bar])
  useDocumentMeta({
    title: bar ? `${bar.name} · ${bar.category ?? 'Bar'} en ${bar.neighborhood ?? bar.city}` : notFound ? 'Bar no disponible' : 'Cargando bar',
    description: bar?.description?.slice(0, 155) ?? undefined,
    image: bar?.images[0]?.url,
    jsonLd,
  })

  if (isLoading) return <DetailSkeleton />
  if (notFound) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={MapPinOff}
          title="Este bar no está disponible"
          description="Puede que haya cambiado de dirección, que ya no esté publicado o que el enlace sea incorrecto."
          action={<Link to="/explorar" className={buttonVariants()}>Explorar bares</Link>}
        />
      </div>
    )
  }
  if (error || !bar) return <div className="container-page py-20"><ErrorState error={error} onRetry={() => refetch()} /></div>

  return <BarView bar={bar} />
}

/** Vista de un bar. `preview` la usa el panel del propietario (sin acciones públicas). */
export function BarView({ bar, preview }: { bar: Bar; preview?: boolean }) {
  const toast = useToast()
  const today = todayIndex(bar.timezone)
  const place = [bar.neighborhood, bar.city].filter(Boolean).join(', ')

  const fav = useFavoriteAction()
  const saved = fav.isFavorite(bar.id)
  const [reporting, setReporting] = useState(false)

  // Una visita por carga de página (el servidor deduplica por visitante y día).
  useEffect(() => {
    if (!preview) trackEvent(bar.slug, 'view')
  }, [bar.slug, preview])

  const onShare = async () => {
    const r = await shareBar(bar)
    if (r === 'shared' || r === 'copied') trackEvent(bar.slug, 'share')
    if (r === 'copied') toast({ tone: 'success', title: 'Enlace copiado', description: 'Pégalo donde quieras compartirlo.' })
    if (r === 'failed') toast({ tone: 'error', title: 'No se pudo compartir', description: 'Copia el enlace desde la barra del navegador.' })
  }
  const onDirections = () => !preview && trackEvent(bar.slug, 'directions')
  const saveButton = (props: { className?: string; size?: 'sm' | 'lg' | 'icon' }) => (
    <Button
      variant={props.size === 'icon' ? 'outline' : 'ghost'}
      size={props.size ?? 'sm'}
      onClick={() => fav.toggle(bar)}
      aria-pressed={saved}
      aria-label={saved ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      className={props.className}
    >
      <Heart className={saved ? 'fill-brand-600 text-brand-600' : ''} /> {props.size !== 'icon' && (saved ? 'Guardado' : 'Guardar')}
    </Button>
  )

  return (
    <article className={preview ? '' : 'pb-28 md:pb-0'}>
      <div className={preview ? '' : 'container-page pt-4 md:pt-8'}>
        <div className={cn('mb-4 items-center justify-between', preview ? 'hidden' : 'hidden md:flex')}>
          <Link to="/explorar" className="inline-flex items-center gap-1 text-sm font-semibold text-fg-muted hover:text-fg">
            <ChevronLeft className="size-4" /> Explorar
          </Link>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onShare}><Share2 /> Compartir</Button>
            {saveButton({})}
          </div>
        </div>

        <Gallery images={bar.images} name={bar.name} />

        <div className="mt-6 grid gap-10 md:mt-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
          <div className="min-w-0">
            {/* Encabezado */}
            <header>
              <div className="flex flex-wrap items-center gap-2">
                {bar.category && <Badge tone="brand">{bar.category}</Badge>}
                {bar.type && <Badge>{bar.type}</Badge>}
                {bar.isVerified && <Badge tone="info"><BadgeCheck /> Verificado</Badge>}
              </div>
              <h1 className="mt-3 text-[32px] font-extrabold leading-[1.08] md:text-[44px]">{bar.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] text-fg-muted">
                <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{place}</span>
                <span className="inline-flex items-center gap-1.5">
                  <PriceRange value={bar.priceRange} /> <span className="text-sm">{PRICE_RANGE_LABELS[bar.priceRange]}</span>
                </span>
                <OpenStatus bar={bar} />
              </div>
            </header>

            {bar.description && (
              <section className="mt-8 border-t border-line pt-8">
                <h2 className="sr-only">Descripción</h2>
                <p className="whitespace-pre-line text-[17px] leading-relaxed text-ink-700">{bar.description}</p>
              </section>
            )}

            {bar.amenities.length > 0 && (
              <section className="mt-8 border-t border-line pt-8">
                <h2 className="text-[22px] font-bold">Servicios y amenidades</h2>
                <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                  {bar.amenities.map((a) => {
                    const Icon = iconFor(a.icon)
                    return (
                      <li key={a.slug} className="flex items-center gap-3 text-[15px]">
                        <Icon className="size-6 text-ink-700" strokeWidth={1.6} aria-hidden /> {a.name}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <section className="mt-8 border-t border-line pt-8" id="ubicacion">
              <h2 className="text-[22px] font-bold">Ubicación</h2>
              <p className="mt-2 text-[15px] text-fg-muted">
                {bar.address}, {place}{bar.postalCode && `, C.P. ${bar.postalCode}`}
              </p>
              <div className="relative isolate z-0 mt-5 aspect-[16/10] overflow-hidden rounded-2xl border border-line md:aspect-[16/7]">
                <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
                  <LocationMap lat={bar.latitude} lng={bar.longitude} label={bar.name} />
                </Suspense>
              </div>
              <a href={directionsUrl(bar)} onClick={onDirections} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', className: 'mt-4' })}>
                <Navigation /> Cómo llegar
              </a>
            </section>
          </div>

          {/* Columna lateral */}
          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <div className="hidden rounded-3xl border border-line p-6 shadow-md lg:block">
              <OpenStatus bar={bar} large />
              <div className="mt-5 grid gap-3">
                <a href={directionsUrl(bar)} onClick={onDirections} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: 'lg', block: true })}>
                  <Navigation /> Cómo llegar
                </a>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={onShare}><Share2 /> Compartir</Button>
                  <Button variant="outline" onClick={() => fav.toggle(bar)} aria-pressed={saved}>
                    <Heart className={saved ? 'fill-brand-600 text-brand-600' : ''} /> {saved ? 'Guardado' : 'Guardar'}
                  </Button>
                </div>
              </div>
            </div>

            <HoursCard bar={bar} today={today} />
            <ContactCard bar={bar} />
            {!preview && (
              <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center gap-2 px-1 text-sm font-semibold text-fg-muted underline-offset-4 hover:text-fg hover:underline">
                <Flag className="size-4" /> Reportar un problema con este lugar
              </button>
            )}
          </aside>
        </div>

        {bar.nearby.length > 0 && (
          <section className="mt-14 border-t border-line pt-10">
            <h2 className="text-[24px] font-bold md:text-[28px]">Otros bares cerca</h2>
            <div className="scrollbar-none -mx-4 mt-6 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:px-0 lg:grid-cols-4">
              {bar.nearby.slice(0, 4).map((b) => (
                <div key={b.id} className="w-[78%] shrink-0 snap-start sm:w-[45%] md:w-auto">
                  <BarCard bar={b} isFavorite={fav.isFavorite(b.id)} onToggleFavorite={fav.toggle} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Barra de acciones fija en móvil */}
      {!preview && <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/explorar" aria-label="Volver a explorar" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong">
            <ChevronLeft className="size-5" />
          </Link>
          <Button variant="outline" size="icon" onClick={onShare} aria-label="Compartir" className="size-11 shrink-0">
            <Share2 />
          </Button>
          {saveButton({ size: 'icon', className: 'size-11 shrink-0' })}
          <a href={directionsUrl(bar)} onClick={onDirections} target="_blank" rel="noopener noreferrer" className={buttonVariants({ block: true, className: 'flex-1' })}>
            <Navigation /> Cómo llegar
          </a>
        </div>
      </div>}
      {!preview && <ReportModal open={reporting} onClose={() => setReporting(false)} slug={bar.slug} name={bar.name} />}
    </article>
  )
}

function OpenStatus({ bar, large }: { bar: Bar; large?: boolean }) {
  if (bar.isOpenNow === undefined) return null
  const next = bar.isOpenNow ? null : nextOpening(bar)
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold', large ? 'text-lg' : 'text-[15px]', bar.isOpenNow ? 'text-success-700' : 'text-fg-muted')}>
      <span className={cn('size-2.5 rounded-full', bar.isOpenNow ? 'bg-success-600' : 'bg-ink-400')} aria-hidden />
      {bar.isOpenNow ? `Abierto ahora${bar.closesAt ? ` · cierra a las ${bar.closesAt}` : ''}` : 'Cerrado ahora'}
      {!bar.isOpenNow && next && <span className="font-normal text-fg-muted">· {next}</span>}
    </span>
  )
}

function HoursCard({ bar, today }: { bar: Bar; today: number }) {
  if (!bar.hours.length) return null
  return (
    <section className="rounded-3xl border border-line p-6">
      <h2 className="flex items-center gap-2 font-sans text-base font-bold tracking-normal"><Clock className="size-5" /> Horarios</h2>
      <dl className="mt-4 space-y-2.5 text-[15px]">
        {bar.hours.map((h) => {
          const isToday = h.dayOfWeek === today
          const overnight = h.opens && h.closes && h.closes <= h.opens
          return (
            <div key={h.dayOfWeek} className={cn('flex justify-between gap-4', isToday ? 'font-bold text-fg' : 'text-fg-muted')}>
              <dt>{DAY_LABELS[h.dayOfWeek as DayOfWeek]}{isToday && <span className="ml-2 text-xs font-semibold text-brand-600">Hoy</span>}</dt>
              <dd className="tabular-nums">
                {h.isClosed ? 'Cerrado' : `${h.opens} – ${h.closes}${overnight ? '*' : ''}`}
              </dd>
            </div>
          )
        })}
      </dl>
      {bar.hours.some((h) => h.opens && h.closes && h.closes <= h.opens) && (
        <p className="mt-4 text-xs text-fg-subtle">* Cierra después de la medianoche.</p>
      )}
    </section>
  )
}

function ContactCard({ bar }: { bar: Bar }) {
  const socials = Object.entries(bar.socialLinks) as [keyof typeof SOCIAL_LABELS, string][]
  if (!bar.phone && !bar.website && !socials.length) return null
  return (
    <section className="rounded-3xl border border-line p-6">
      <h2 className="font-sans text-base font-bold tracking-normal">Contacto</h2>
      <ul className="mt-4 space-y-3 text-[15px]">
        {bar.phone && (
          <li>
            <a href={`tel:${bar.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-3 font-medium hover:underline">
              <Phone className="size-5 text-fg-muted" /> {bar.phone}
            </a>
          </li>
        )}
        {bar.website && (
          <li>
            <a href={bar.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-3 font-medium hover:underline">
              <Globe className="size-5 text-fg-muted" /> {new URL(bar.website).hostname.replace(/^www\./, '')} <ExternalLink className="size-3.5 text-fg-subtle" />
            </a>
          </li>
        )}
        {socials.map(([k, url]) => (
          <li key={k}>
            <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-3 font-medium hover:underline">
              <AtSign className="size-5 text-fg-muted" /> {SOCIAL_LABELS[k]} <ExternalLink className="size-3.5 text-fg-subtle" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-page pt-4 md:pt-8" aria-busy>
      <Skeleton className="-mx-4 aspect-[4/3] rounded-none md:mx-0 md:aspect-auto md:h-[420px] md:rounded-3xl" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40 rounded-full" />
          <Skeleton className="h-11 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="mt-8 h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    </div>
  )
}
