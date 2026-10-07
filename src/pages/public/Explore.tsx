import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { List, LocateFixed, Map as MapIcon, MapPin, Search, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { BarCard, BarCardSkeleton } from '@/components/bars/BarCard'
import { ErrorState } from '@/components/ErrorState'
import { iconFor } from '@/components/icons/registry'
import { Alert, Button, EmptyState, Pagination, SegmentedControl, Skeleton } from '@/components/ui'
import { useBarSearch, useCatalog } from '@/features/bars/queries'
import { countPanelFilters, parseFilters, serializeFilters, SORT_LABELS, type ExploreFilters } from '@/features/bars/filters'
import { FiltersModal } from '@/features/explore/FiltersModal'
import { useFavoriteAction } from '@/features/engagement'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { cn } from '@/lib/cn'
import type { SortOption } from '@/types/api'

const BarMap = lazy(() => import('@/components/map/BarMap'))
const PAGE_SIZE = 24

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseFilters(searchParams)
  const geo = useGeolocation()
  const catalog = useCatalog()
  const coords = geo.status === 'granted' ? geo.coords : undefined
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fav = useFavoriteAction()

  /** Cualquier cambio de filtros vuelve a la página 1, salvo que se indique. */
  const update = (patch: Partial<ExploreFilters>, opts: { keepPage?: boolean } = {}) => {
    const next = { ...filters, ...patch }
    if (!opts.keepPage) next.page = 1
    setSearchParams(serializeFilters(next), { replace: false })
  }

  const needsLocation = (filters.orden === 'distance' || !!filters.radio) && !coords
  const search = useBarSearch({
    q: filters.q || undefined,
    donde: filters.donde || undefined,
    categoria: filters.categoria || undefined,
    precio: filters.precio,
    servicios: filters.servicios,
    abierto: filters.abierto,
    lat: coords?.lat,
    lng: coords?.lng,
    radio: coords ? filters.radio : undefined,
    bbox: filters.bbox,
    orden: filters.orden,
    page: filters.page,
    pageSize: PAGE_SIZE,
  })
  const data = search.data
  const categoryName = catalog.data?.categories.find((c) => c.slug === filters.categoria)?.name

  const heading = [filters.q && `“${filters.q}”`, categoryName, filters.donde && `en ${filters.donde}`].filter(Boolean).join(' · ')
  useDocumentMeta({
    title: heading ? `Bares: ${heading}` : 'Explorar bares',
    description: 'Busca bares por nombre, zona, categoría, precio y servicios. Vista de lista y mapa.',
  })

  useEffect(() => setSelectedId(null), [searchParams])

  const isMap = filters.vista === 'mapa'
  const panelCount = countPanelFilters(filters)

  const chips: { key: string; label: string; clear: Partial<ExploreFilters> }[] = [
    filters.q && { key: 'q', label: `“${filters.q}”`, clear: { q: '' } },
    filters.donde && { key: 'donde', label: filters.donde, clear: { donde: '' } },
    filters.bbox && { key: 'bbox', label: 'Zona del mapa', clear: { bbox: undefined } },
    filters.abierto && { key: 'abierto', label: 'Abierto ahora', clear: { abierto: false } },
    filters.precio.length > 0 && { key: 'precio', label: filters.precio.map((p) => '$'.repeat(p)).join(', '), clear: { precio: [] } },
    filters.radio && { key: 'radio', label: `A ${filters.radio} km`, clear: { radio: undefined } },
    ...filters.servicios.map((s) => ({
      key: `s-${s}`,
      label: catalog.data?.amenities.find((a) => a.slug === s)?.name ?? s,
      clear: { servicios: filters.servicios.filter((x) => x !== s) },
    })),
  ].filter(Boolean) as { key: string; label: string; clear: Partial<ExploreFilters> }[]

  const clearAll = () => setSearchParams(serializeFilters({ vista: filters.vista }))

  const results = (
    <>
      {needsLocation && (
        <Alert
          tone="info"
          className="mb-6"
          title="Activa tu ubicación para ordenar por cercanía"
          action={
            <Button size="sm" variant="dark" onClick={geo.request} loading={geo.status === 'requesting'}>
              <LocateFixed /> Usar mi ubicación
            </Button>
          }
        >
          {geo.status === 'denied' || geo.status === 'unavailable'
            ? 'No pudimos acceder a tu ubicación; mostramos los más populares.'
            : 'Mientras tanto mostramos los más populares.'}
        </Alert>
      )}

      {search.isError && !data ? (
        <ErrorState error={search.error} onRetry={() => search.refetch()} />
      ) : data && data.total === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No encontramos bares con esos filtros"
          description="Prueba con otra zona, quita algún servicio o amplía la distancia."
          action={<Button variant="outline" onClick={clearAll}>Limpiar filtros</Button>}
        />
      ) : (
        <div
          className={cn(
            'grid grid-cols-1 gap-x-6 gap-y-10 transition-opacity sm:grid-cols-2',
            isMap ? 'xl:grid-cols-2' : 'lg:grid-cols-3 xl:grid-cols-4',
            search.isPlaceholderData && 'opacity-60',
          )}
          aria-busy={search.isFetching}
        >
          {!data
            ? Array.from({ length: 8 }, (_, i) => <BarCardSkeleton key={i} />)
            : data.items.map((bar) => (
                <BarCard key={bar.id} bar={bar} onHoverChange={isMap ? setHoveredId : undefined} highlighted={bar.id === selectedId} isFavorite={fav.isFavorite(bar.id)} onToggleFavorite={fav.toggle} />
              ))}
        </div>
      )}

      {data && (
        <Pagination
          className="mt-12"
          page={data.page}
          totalPages={data.totalPages}
          onChange={(page) => {
            update({ page }, { keepPage: true })
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      )}
    </>
  )

  const map = (
    <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
      <BarMap
        bars={data?.items ?? []}
        hoveredId={hoveredId}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onSearchArea={(bbox) => update({ bbox, donde: '' })}
        userLocation={coords}
        className="h-full w-full"
      />
    </Suspense>
  )

  return (
    <>
      {/* Barra de búsqueda y filtros */}
      <div className="sticky top-16 z-30 border-b border-line bg-canvas/95 backdrop-blur-md md:top-20">
        <div className="container-page space-y-3 py-3">
          <SearchForm key={`${filters.q}|${filters.donde}`} q={filters.q} donde={filters.donde} onSubmit={(q, donde) => update({ q, donde, bbox: undefined })} />
          <div className="flex items-center gap-2">
            <div className="scrollbar-none -ml-1 flex flex-1 gap-2 overflow-x-auto py-1 pl-1">
              <CategoryChip active={!filters.categoria} onClick={() => update({ categoria: '' })} label="Todos" />
              {catalog.data?.categories.filter((c) => c.barCount > 0).map((c) => (
                <CategoryChip key={c.slug} icon={c.icon} active={filters.categoria === c.slug} onClick={() => update({ categoria: c.slug })} label={c.name} />
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)} className="relative shrink-0">
              <SlidersHorizontal /> <span className="hidden sm:inline">Filtros</span>
              {panelCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-ink-900 text-[11px] text-white">{panelCount}</span>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className={cn(isMap && 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]')}>
        <div className={cn('container-page py-6 md:py-8', isMap && 'hidden lg:block lg:max-w-none')}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-sans text-lg font-bold tracking-normal text-fg md:text-xl">
                {data ? `${data.total} ${data.total === 1 ? 'bar' : 'bares'}` : <Skeleton className="h-6 w-28" />}
                {heading && <span className="font-normal text-fg-muted"> · {heading}</span>}
              </h1>
              {data && !needsLocation && data.sort && (
                <p className="text-sm text-fg-muted">Ordenados por: {SORT_LABELS[data.sort].toLowerCase()}</p>
              )}
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <label className="flex items-center gap-2 text-sm text-fg-muted">
                Ordenar
                <select
                  value={filters.orden ?? data?.sort ?? ''}
                  onChange={(e) => update({ orden: e.target.value as SortOption })}
                  className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-fg focus:border-ink-900 focus:outline-none"
                >
                  {(filters.q ? (['relevance'] as SortOption[]) : []).concat(['recommended', 'popular', 'distance', 'newest']).map((s) => (
                    <option key={s} value={s}>{SORT_LABELS[s]}</option>
                  ))}
                </select>
              </label>
              <SegmentedControl
                label="Vista de resultados"
                value={filters.vista}
                onChange={(vista) => update({ vista }, { keepPage: true })}
                options={[{ value: 'lista', label: 'Lista', icon: List }, { value: 'mapa', label: 'Mapa', icon: MapIcon }]}
              />
            </div>
          </div>

          {chips.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => update(c.clear)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink-100 pl-3 pr-2 text-sm font-medium text-fg hover:bg-ink-200"
                  aria-label={`Quitar filtro ${c.label}`}
                >
                  {c.label} <X className="size-3.5" />
                </button>
              ))}
              <button type="button" onClick={clearAll} className="px-2 text-sm font-semibold text-fg underline underline-offset-4">
                Limpiar todo
              </button>
            </div>
          )}

          {results}
        </div>

        {isMap && (
          <div className="h-[calc(100dvh-4rem-7.5rem-4rem)] lg:sticky lg:top-[calc(5rem+7.75rem)] lg:h-[calc(100dvh-5rem-7.75rem)] lg:border-l lg:border-line">
            {map}
          </div>
        )}
      </div>

      {/* Alternar vista en móvil */}
      <button
        type="button"
        onClick={() => update({ vista: isMap ? 'lista' : 'mapa' }, { keepPage: true })}
        className="fixed bottom-20 left-1/2 z-40 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-ink-900 px-5 text-sm font-semibold text-white shadow-lg active:scale-95 md:hidden"
      >
        {isMap ? <List className="size-4" /> : <MapIcon className="size-4" />}
        {isMap ? 'Ver lista' : 'Ver mapa'}
      </button>

      <FiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={filters}
        geoStatus={geo.status}
        onRequestLocation={geo.request}
        onApply={(panel) => {
          setFiltersOpen(false)
          update(panel)
        }}
      />
    </>
  )
}

function SearchForm({ q, donde, onSubmit }: { q: string; donde: string; onSubmit: (q: string, donde: string) => void }) {
  const [qv, setQ] = useState(q)
  const [dv, setD] = useState(donde)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(qv.trim(), dv.trim())
  }
  return (
    <form role="search" onSubmit={submit} className="flex h-12 items-center rounded-full border border-line-strong bg-surface pl-4 pr-1.5 shadow-xs focus-within:border-ink-900 md:max-w-2xl">
      <Search className="size-4 shrink-0 text-fg-muted" aria-hidden />
      <input
        value={qv}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar bares"
        aria-label="Qué buscas"
        maxLength={80}
        className="h-full min-w-0 flex-[1.4] bg-transparent px-3 text-[15px] placeholder:text-fg-subtle focus:outline-none"
      />
      <span className="h-6 w-px bg-line-strong" aria-hidden />
      <MapPin className="ml-3 size-4 shrink-0 text-fg-muted" aria-hidden />
      <input
        value={dv}
        onChange={(e) => setD(e.target.value)}
        placeholder="Ciudad o zona"
        aria-label="Dónde"
        maxLength={80}
        list="barmap-cities"
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] placeholder:text-fg-subtle focus:outline-none"
      />
      <CitiesDatalist />
      <button type="submit" aria-label="Buscar" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700">
        <Search className="size-4" strokeWidth={2.5} />
      </button>
    </form>
  )
}

function CitiesDatalist() {
  const catalog = useCatalog()
  return (
    <datalist id="barmap-cities">
      {catalog.data?.cities.map((c) => <option key={c.name} value={c.name} />)}
    </datalist>
  )
}

function CategoryChip({ label, icon, active, onClick }: { label: string; icon?: string | null; active: boolean; onClick: () => void }) {
  const Icon = icon ? iconFor(icon) : null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
        active ? 'border-ink-900 bg-ink-900 text-white' : 'border-line-strong bg-surface text-fg hover:border-ink-900',
      )}
    >
      {Icon && <Icon className="size-4" aria-hidden />}
      {label}
    </button>
  )
}
