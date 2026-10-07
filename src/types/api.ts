import type { PriceRange } from './domain'

/** Tarjeta pública de un bar, tal como la devuelve GET /api/bars. */
export interface BarSummary {
  id: string
  slug: string
  name: string
  category: string
  categorySlug?: string | null
  neighborhood: string
  city: string
  priceRange: PriceRange
  coverUrl: string | null
  imageUrls?: string[]
  latitude?: number
  longitude?: number
  distanceMeters?: number
  isOpenNow?: boolean
  closesAt?: string
  isFeatured?: boolean
  isVerified?: boolean
}

export type SortOption = 'relevance' | 'distance' | 'popular' | 'recommended' | 'newest'

export interface SearchResult {
  items: BarSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  sort: SortOption
}

export interface BarHour {
  dayOfWeek: number
  opens: string | null
  closes: string | null
  isClosed: boolean
}

export interface CatalogItem {
  name: string
  slug: string
  icon?: string | null
}

export interface BarDetail {
  id: string
  slug: string
  name: string
  description: string | null
  category: string | null
  categorySlug: string | null
  categoryIcon: string | null
  type: string | null
  priceRange: PriceRange
  address: string
  neighborhood: string | null
  city: string
  state: string | null
  country: string
  postalCode: string | null
  latitude: number
  longitude: number
  timezone: string
  phone: string | null
  website: string | null
  socialLinks: Partial<Record<'instagram' | 'facebook' | 'tiktok' | 'x', string>>
  isOpenNow?: boolean
  closesAt?: string
  isFeatured: boolean
  isVerified: boolean
  publishedAt: string
  updatedAt: string
  images: { url: string; width: number | null; height: number | null; isCover: boolean }[]
  hours: BarHour[]
  amenities: CatalogItem[]
  nearby: BarSummary[]
}

export interface Catalog {
  categories: (CatalogItem & { id: number; barCount: number })[]
  types: (CatalogItem & { id: number })[]
  amenities: (CatalogItem & { id: number })[]
  cities: { name: string; barCount: number }[]
}
