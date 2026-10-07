import { query } from '../db/pool.js'
import { Params, likeEscape } from '../lib/query.js'

/**
 * Consultas del lado público. TODAS parten de la vista `public_bars`, que ya
 * excluye borradores, pendientes, suspendidos y bares de cuentas suspendidas.
 * Los resultados pasan por serializadores explícitos: nunca se devuelve una
 * fila tal cual.
 */

export type SortOption = 'relevance' | 'distance' | 'popular' | 'recommended' | 'newest'

export interface SearchParams {
  q?: string
  where?: string
  category?: string
  prices?: number[]
  amenities?: string[]
  openNow?: boolean
  lat?: number
  lng?: number
  radiusKm?: number
  bbox?: [number, number, number, number] // minLat, minLng, maxLat, maxLng
  sort: SortOption
  page: number
  pageSize: number
  excludeId?: string
  /** Limita a estos ids (favoritos). */
  ids?: string[]
}

const haversine = (lat: string, lng: string) => `(6371000 * 2 * asin(sqrt(
  power(sin(radians(pb.latitude - ${lat}) / 2), 2) +
  cos(radians(${lat})) * cos(radians(pb.latitude)) * power(sin(radians(pb.longitude - ${lng}) / 2), 2)
)))`

interface SummaryRow {
  id: string
  slug: string
  name: string
  neighborhood: string | null
  city: string | null
  price_range: number
  latitude: string
  longitude: string
  is_featured: boolean
  is_verified: boolean
  category: string | null
  category_slug: string | null
  images: string[]
  is_open: boolean
  closes_at: string | null
  has_hours: boolean
  distance_m: number | null
  total: string
}

export function serializeSummary(r: SummaryRow) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category ?? 'Bar',
    categorySlug: r.category_slug,
    neighborhood: r.neighborhood ?? r.city ?? '',
    city: r.city ?? '',
    priceRange: r.price_range,
    coverUrl: r.images[0] ?? null,
    imageUrls: r.images,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    distanceMeters: r.distance_m == null ? undefined : Math.round(r.distance_m),
    isOpenNow: r.has_hours ? r.is_open : undefined,
    closesAt: r.is_open && r.closes_at ? r.closes_at.slice(0, 5) : undefined,
    isFeatured: r.is_featured,
    isVerified: r.is_verified,
  }
}

export async function searchBars(s: SearchParams) {
  const p = new Params()
  const where: string[] = []
  const hasGeo = s.lat !== undefined && s.lng !== undefined
  const distance = hasGeo ? haversine(p.add(s.lat), p.add(s.lng)) : 'NULL::float8'
  let relevance = '0'

  if (s.q) {
    const like = p.add(`%${likeEscape(s.q)}%`)
    const raw = p.add(s.q)
    where.push(`(
      unaccent(pb.name) ILIKE unaccent(${like})
      OR unaccent(coalesce(pb.neighborhood, '')) ILIKE unaccent(${like})
      OR unaccent(coalesce(c.name, '')) ILIKE unaccent(${like})
      OR unaccent(coalesce(t.name, '')) ILIKE unaccent(${like})
      OR unaccent(coalesce(pb.description, '')) ILIKE unaccent(${like})
    )`)
    relevance = `(similarity(unaccent(lower(pb.name)), unaccent(lower(${raw}))) * 3
      + CASE WHEN unaccent(pb.name) ILIKE unaccent(${like}) THEN 1 ELSE 0 END
      + CASE WHEN unaccent(coalesce(c.name, '')) ILIKE unaccent(${like}) THEN 0.5 ELSE 0 END)`
  }
  if (s.where) {
    const like = p.add(`%${likeEscape(s.where)}%`)
    where.push(`(unaccent(coalesce(pb.city, '')) ILIKE unaccent(${like})
      OR unaccent(coalesce(pb.neighborhood, '')) ILIKE unaccent(${like})
      OR unaccent(coalesce(pb.state, '')) ILIKE unaccent(${like}))`)
  }
  if (s.category) where.push(`c.slug = ${p.add(s.category)}`)
  if (s.prices?.length) where.push(`pb.price_range = ANY(${p.add(s.prices)}::smallint[])`)
  if (s.amenities?.length) {
    const arr = p.add(s.amenities)
    where.push(`(SELECT count(*) FROM bar_amenities ba JOIN amenities a ON a.id = ba.amenity_id
      WHERE ba.bar_id = pb.id AND a.slug = ANY(${arr}::text[])) = cardinality(${arr}::text[])`)
  }
  if (s.bbox) {
    const [minLat, minLng, maxLat, maxLng] = s.bbox
    where.push(`pb.latitude BETWEEN ${p.add(minLat)} AND ${p.add(maxLat)} AND pb.longitude BETWEEN ${p.add(minLng)} AND ${p.add(maxLng)}`)
  }
  if (s.excludeId) where.push(`pb.id <> ${p.add(s.excludeId)}`)
  if (s.ids) where.push(`pb.id = ANY(${p.add(s.ids)}::uuid[])`)

  const outer: string[] = []
  if (s.openNow) outer.push('is_open')
  if (hasGeo && s.radiusKm) outer.push(`distance_m <= ${p.add(s.radiusKm * 1000)}`)

  const sort = s.sort === 'distance' && !hasGeo ? 'popular' : s.sort === 'relevance' && !s.q ? 'recommended' : s.sort
  const orderBy = {
    relevance: 'relevance DESC, popularity DESC',
    distance: 'distance_m ASC',
    popular: 'popularity DESC, is_featured DESC',
    recommended: 'is_featured DESC, is_verified DESC, image_count DESC, popularity DESC',
    newest: 'published_at DESC NULLS LAST',
  }[sort]

  const limit = p.add(s.pageSize)
  const offset = p.add((s.page - 1) * s.pageSize)

  const sql = `
    SELECT *, count(*) OVER() AS total FROM (
      SELECT pb.id, pb.slug, pb.name, pb.neighborhood, pb.city, pb.price_range,
             pb.latitude, pb.longitude, pb.is_featured, pb.is_verified, pb.published_at,
             c.name AS category, c.slug AS category_slug,
             coalesce(img.urls, '{}') AS images, coalesce(img.n, 0) AS image_count,
             os.is_open, os.closes_at::text AS closes_at, os.has_hours,
             ${distance} AS distance_m,
             ${relevance} AS relevance,
             coalesce(st.views, 0) + 5 * coalesce(fv.n, 0) AS popularity
      FROM public_bars pb
      LEFT JOIN categories c ON c.id = pb.category_id
      LEFT JOIN establishment_types t ON t.id = pb.type_id
      LEFT JOIN LATERAL (
        SELECT array_agg(url ORDER BY is_cover DESC, sort_order) AS urls, count(*) AS n
        FROM (SELECT coalesce(thumb_url, image_url) AS url, is_cover, sort_order FROM bar_images
              WHERE bar_id = pb.id AND revision_id IS NULL
              ORDER BY is_cover DESC, sort_order LIMIT 5) i
      ) img ON true
      LEFT JOIN LATERAL bar_open_state(pb.id, pb.timezone) os ON true
      LEFT JOIN LATERAL (SELECT sum(views) AS views FROM bar_daily_stats
                         WHERE bar_id = pb.id AND day > current_date - 30) st ON true
      LEFT JOIN LATERAL (SELECT count(*) AS n FROM favorites WHERE bar_id = pb.id) fv ON true
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ) base
    ${outer.length ? `WHERE ${outer.join(' AND ')}` : ''}
    ORDER BY ${orderBy}, id
    LIMIT ${limit} OFFSET ${offset}`

  const { rows } = await query<SummaryRow>(sql, p.values)
  const total = rows.length ? Number(rows[0].total) : 0
  return {
    items: rows.map(serializeSummary),
    page: s.page,
    pageSize: s.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / s.pageSize)),
    sort,
  }
}

const SOCIAL_KEYS = ['instagram', 'facebook', 'tiktok', 'x'] as const

/** Solo URLs https de redes conocidas: evita javascript: u otros esquemas. */
function safeSocialLinks(raw: unknown) {
  const out: Partial<Record<(typeof SOCIAL_KEYS)[number], string>> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const key of SOCIAL_KEYS) {
    const v = (raw as Record<string, unknown>)[key]
    if (typeof v === 'string' && /^https:\/\//i.test(v)) out[key] = v
  }
  return out
}

const safeUrl = (v: string | null) => (v && /^https?:\/\//i.test(v) ? v : null)

export async function getBarBySlug(slug: string) {
  const { rows } = await query(
    `SELECT pb.*, c.name AS category, c.slug AS category_slug, c.icon AS category_icon,
            t.name AS type_name, os.is_open, os.closes_at::text AS closes_at, os.has_hours
     FROM public_bars pb
     LEFT JOIN categories c ON c.id = pb.category_id
     LEFT JOIN establishment_types t ON t.id = pb.type_id
     LEFT JOIN LATERAL bar_open_state(pb.id, pb.timezone) os ON true
     WHERE pb.slug = $1`,
    [slug],
  )
  const b = rows[0]
  if (!b) return null

  const [images, hours, amenities] = await Promise.all([
    query(`SELECT image_url, width, height, is_cover FROM bar_images WHERE bar_id = $1 AND revision_id IS NULL ORDER BY is_cover DESC, sort_order`, [b.id]),
    query(`SELECT day_of_week, to_char(opening_time, 'HH24:MI') AS opens, to_char(closing_time, 'HH24:MI') AS closes, is_closed
           FROM bar_hours WHERE bar_id = $1 ORDER BY day_of_week`, [b.id]),
    query(`SELECT a.name, a.slug, a.icon FROM bar_amenities ba JOIN amenities a ON a.id = ba.amenity_id
           WHERE ba.bar_id = $1 AND a.is_active ORDER BY a.sort_order`, [b.id]),
  ])

  const nearby = await searchBars({
    lat: Number(b.latitude), lng: Number(b.longitude), radiusKm: 5,
    sort: 'distance', page: 1, pageSize: 6, excludeId: b.id,
  })

  return {
    id: b.id as string,
    slug: b.slug as string,
    name: b.name as string,
    description: b.description as string | null,
    category: b.category as string | null,
    categorySlug: b.category_slug as string | null,
    categoryIcon: b.category_icon as string | null,
    type: b.type_name as string | null,
    priceRange: b.price_range as number,
    address: b.address as string,
    neighborhood: b.neighborhood as string | null,
    city: b.city as string,
    state: b.state as string | null,
    country: b.country as string,
    postalCode: b.postal_code as string | null,
    latitude: Number(b.latitude),
    longitude: Number(b.longitude),
    timezone: b.timezone as string,
    phone: b.phone as string | null,
    website: safeUrl(b.website),
    socialLinks: safeSocialLinks(b.social_links),
    isOpenNow: b.has_hours ? (b.is_open as boolean) : undefined,
    closesAt: b.is_open && b.closes_at ? (b.closes_at as string).slice(0, 5) : undefined,
    isFeatured: b.is_featured as boolean,
    isVerified: b.is_verified as boolean,
    publishedAt: b.published_at as string,
    updatedAt: b.updated_at as string,
    images: images.rows.map((i) => ({ url: i.image_url, width: i.width, height: i.height, isCover: i.is_cover })),
    hours: hours.rows.map((h) => ({ dayOfWeek: h.day_of_week, opens: h.opens, closes: h.closes, isClosed: h.is_closed })),
    amenities: amenities.rows,
    nearby: nearby.items,
  }
}

export async function getCatalog() {
  const [categories, types, amenities, cities] = await Promise.all([
    query(`SELECT c.id, c.name, c.slug, c.icon,
             (SELECT count(*)::int FROM public_bars pb WHERE pb.category_id = c.id) AS "barCount"
           FROM categories c WHERE c.is_active ORDER BY c.sort_order, c.name`),
    query(`SELECT id, name, slug FROM establishment_types WHERE is_active ORDER BY sort_order, name`),
    query(`SELECT id, name, slug, icon FROM amenities WHERE is_active ORDER BY sort_order, name`),
    query(`SELECT city AS name, count(*)::int AS "barCount" FROM public_bars
           WHERE city IS NOT NULL GROUP BY city ORDER BY count(*) DESC, city LIMIT 20`),
  ])
  return { categories: categories.rows, types: types.rows, amenities: amenities.rows, cities: cities.rows }
}
