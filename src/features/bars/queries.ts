import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { BarDetail, Catalog, SearchResult, SortOption } from '@/types/api'

export interface BarSearchParams {
  q?: string
  donde?: string
  categoria?: string
  precio?: number[]
  servicios?: string[]
  abierto?: boolean
  lat?: number
  lng?: number
  radio?: number
  bbox?: number[]
  orden?: SortOption
  page?: number
  pageSize?: number
}

export const barKeys = {
  search: (p: BarSearchParams) => ['bars', 'search', p] as const,
  detail: (slug: string) => ['bars', 'detail', slug] as const,
  catalog: ['catalog'] as const,
}

export function useBarSearch(params: BarSearchParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: barKeys.search(params),
    queryFn: ({ signal }) => apiGet<SearchResult>('/bars', { ...params }, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  })
}

export function useBar(slug: string) {
  return useQuery({
    queryKey: barKeys.detail(slug),
    queryFn: ({ signal }) => apiGet<BarDetail>(`/bars/${encodeURIComponent(slug)}`, {}, signal),
  })
}

export function useCatalog() {
  return useQuery({
    queryKey: barKeys.catalog,
    queryFn: ({ signal }) => apiGet<Catalog>('/catalog', {}, signal),
    staleTime: 10 * 60 * 1000,
  })
}
