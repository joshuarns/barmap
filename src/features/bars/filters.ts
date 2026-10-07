import type { SortOption } from '@/types/api'

/**
 * El estado de búsqueda vive en la URL: se puede compartir, recargar y usar
 * el botón "atrás" sin perder filtros.
 */
export interface ExploreFilters {
  q: string
  donde: string
  categoria: string
  precio: number[]
  servicios: string[]
  abierto: boolean
  radio?: number
  orden?: SortOption
  vista: 'lista' | 'mapa'
  page: number
  bbox?: [number, number, number, number]
}

const SORTS: SortOption[] = ['relevance', 'distance', 'popular', 'recommended', 'newest']
export const RADIUS_OPTIONS = [1, 2, 5, 10, 25]

const list = (v: string | null) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [])

export function parseFilters(sp: URLSearchParams): ExploreFilters {
  const orden = sp.get('orden') as SortOption | null
  const radio = Number(sp.get('radio'))
  const page = Number(sp.get('page'))
  const bbox = list(sp.get('bbox')).map(Number)
  return {
    q: sp.get('q')?.slice(0, 80) ?? '',
    donde: sp.get('donde')?.slice(0, 80) ?? '',
    categoria: sp.get('categoria') ?? '',
    precio: list(sp.get('precio')).map(Number).filter((n) => n >= 1 && n <= 4),
    servicios: list(sp.get('servicios')).slice(0, 12),
    abierto: sp.get('abierto') === '1',
    radio: RADIUS_OPTIONS.includes(radio) ? radio : undefined,
    orden: orden && SORTS.includes(orden) ? orden : undefined,
    vista: sp.get('vista') === 'mapa' ? 'mapa' : 'lista',
    page: Number.isInteger(page) && page > 1 ? page : 1,
    bbox: bbox.length === 4 && bbox.every(Number.isFinite) ? (bbox as ExploreFilters['bbox']) : undefined,
  }
}

export function serializeFilters(f: Partial<ExploreFilters>) {
  const sp = new URLSearchParams()
  if (f.q) sp.set('q', f.q)
  if (f.donde) sp.set('donde', f.donde)
  if (f.categoria) sp.set('categoria', f.categoria)
  if (f.precio?.length) sp.set('precio', f.precio.join(','))
  if (f.servicios?.length) sp.set('servicios', f.servicios.join(','))
  if (f.abierto) sp.set('abierto', '1')
  if (f.radio) sp.set('radio', String(f.radio))
  if (f.orden) sp.set('orden', f.orden)
  if (f.vista === 'mapa') sp.set('vista', 'mapa')
  if (f.page && f.page > 1) sp.set('page', String(f.page))
  if (f.bbox) sp.set('bbox', f.bbox.map((n) => n.toFixed(4)).join(','))
  return sp
}

/** Número de filtros "secundarios" activos (los que viven en el panel de filtros). */
export function countPanelFilters(f: ExploreFilters) {
  return (f.precio.length ? 1 : 0) + (f.servicios.length ? 1 : 0) + (f.abierto ? 1 : 0) + (f.radio ? 1 : 0)
}

export const SORT_LABELS: Record<SortOption, string> = {
  relevance: 'Relevancia',
  recommended: 'Recomendados',
  popular: 'Más populares',
  distance: 'Más cercanos',
  newest: 'Más nuevos',
}
