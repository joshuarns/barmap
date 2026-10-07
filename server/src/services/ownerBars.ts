import type { PoolClient } from 'pg'
import { z } from 'zod'
import { pool, query } from '../db/pool.js'
import { HttpError } from '../lib/http.js'
import { removeStored } from '../lib/images.js'

/**
 * Gestión de establecimientos por su propietario.
 *
 * "Copia de trabajo": lo que el propietario edita.
 * - Bar nunca publicado (draft / changes_requested / rejected): se edita la fila de `bars`.
 * - Bar publicado: los cambios van a una revisión abierta en `bar_revisions`; la versión
 *   pública NO cambia hasta que un admin apruebe la revisión (Etapa 5).
 *
 * Toda consulta filtra por owner_id: un propietario nunca puede leer ni tocar
 * bares ajenos (responde 404, sin revelar que existen).
 */

export const MAX_IMAGES = 12
export const MIN_IMAGES = 3
const MAX_BARS_PER_OWNER = 50

// ---------------------------------------------------------------------
// Esquemas
// ---------------------------------------------------------------------
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora no válida')
const text = (max: number) =>
  z
    .string()
    .max(max, `Máximo ${max} caracteres`)
    .transform((s) => s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim())

const socialHandle = (base: string) =>
  text(200).transform((v) => {
    if (!v) return ''
    if (/^https?:\/\//i.test(v)) return v.replace(/^http:/i, 'https:')
    return `${base}${v.replace(/^@/, '').replace(/[^\w.-]/g, '')}`
  })

export const hoursSchema = z
  .array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      isClosed: z.boolean(),
      opens: time.nullable(),
      closes: time.nullable(),
    }),
  )
  .length(7, 'Se esperan los 7 días')
  .refine((h) => new Set(h.map((d) => d.dayOfWeek)).size === 7, 'Días repetidos')

/** Guardado de borrador: tipos y longitudes correctos, pero campos incompletos permitidos. */
export const draftSchema = z
  .object({
    name: text(80),
    description: text(1200),
    categoryId: z.number().int().positive().nullable(),
    typeId: z.number().int().positive().nullable(),
    country: text(2).pipe(z.string().regex(/^[A-Z]{2}$/, 'País no válido')),
    state: text(80),
    city: text(80),
    neighborhood: text(80),
    address: text(160),
    postalCode: text(10),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    phone: text(25).refine((v) => !v || /^\+?[\d\s()-]{7,25}$/.test(v), 'Teléfono no válido'),
    website: text(300)
      .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
      .refine((v) => !v || z.url({ protocol: /^https?$/ }).safeParse(v).success, 'URL no válida'),
    social: z
      .object({
        instagram: socialHandle('https://instagram.com/').optional().default(''),
        facebook: socialHandle('https://facebook.com/').optional().default(''),
        tiktok: socialHandle('https://tiktok.com/@').optional().default(''),
      })
      .strict(),
    priceRange: z.number().int().min(1).max(4).nullable(),
    hours: hoursSchema,
    amenityIds: z.array(z.number().int().positive()).max(30),
  })
  .strict()

export type BarFields = z.infer<typeof draftSchema>

export interface WorkingImage {
  id: string
  url: string
  thumbUrl: string
}

/** Validación completa antes de enviar a revisión. Devuelve errores por campo. */
export function validateForSubmit(d: BarFields, images: WorkingImage[]) {
  const e: Record<string, string> = {}
  if (d.name.length < 2) e.name = 'Escribe el nombre del bar'
  if (d.description.length < 40) e.description = 'Describe tu bar en al menos 40 caracteres'
  if (!d.categoryId) e.categoryId = 'Elige una categoría'
  if (!d.typeId) e.typeId = 'Elige el tipo de establecimiento'
  if (d.address.length < 5) e.address = 'Escribe la calle y el número'
  if (!d.city) e.city = 'Escribe la ciudad'
  if (!d.state) e.state = 'Escribe el estado'
  if (d.country === 'MX' && d.postalCode && !/^\d{5}$/.test(d.postalCode)) e.postalCode = 'El código postal debe tener 5 dígitos'
  if (d.latitude == null || d.longitude == null) e.location = 'Marca la ubicación en el mapa'
  if (!d.priceRange) e.priceRange = 'Elige un rango de precios'
  const open = d.hours.filter((h) => !h.isClosed)
  if (!open.length) e.hours = 'Indica al menos un día de apertura'
  else if (open.some((h) => !h.opens || !h.closes)) e.hours = 'Completa la hora de apertura y cierre de los días abiertos'
  else if (open.some((h) => h.opens === h.closes)) e.hours = 'La hora de apertura y cierre no pueden ser iguales'
  if (!d.phone && !d.website && !d.social.instagram && !d.social.facebook && !d.social.tiktok) {
    e.contact = 'Agrega al menos un medio de contacto (teléfono, sitio web o red social)'
  }
  if (images.length < MIN_IMAGES) e.images = `Sube al menos ${MIN_IMAGES} fotos`
  return e
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'bar'

async function uniqueSlug(client: PoolClient, base: string, excludeId?: string) {
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`
    const { rowCount } = await client.query(`SELECT 1 FROM bars WHERE slug = $1 AND id <> coalesce($2::uuid, '00000000-0000-0000-0000-000000000000')`, [slug, excludeId ?? null])
    if (!rowCount) return slug
  }
  return `${base}-${Date.now().toString(36)}`
}

export async function withTx<T>(fn: (c: PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const r = await fn(client)
    await client.query('COMMIT')
    return r
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

const NOT_FOUND = () => new HttpError(404, 'Establecimiento no encontrado', 'not_found')

export interface BarRow {
  id: string
  owner_id: string
  slug: string
  publication_status: 'draft' | 'pending_review' | 'published' | 'changes_requested' | 'rejected' | 'suspended'
  moderation_note: string | null
  version: number
  published_at: string | null
  submitted_at: string | null
  updated_at: string
  [k: string]: unknown
}

export interface RevisionRow {
  id: string
  status: 'draft' | 'pending_review' | 'changes_requested'
  snapshot: BarFields & { imageIds: string[] }
  review_comment: string | null
  submitted_at: string | null
  updated_at: string
  base_version: number
}

/** Bloquea y carga el bar del propietario (o 404). */
async function lockBar(c: PoolClient, barId: string, ownerId: string) {
  const { rows } = await c.query<BarRow>(`SELECT * FROM bars WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL FOR UPDATE`, [barId, ownerId])
  if (!rows[0]) throw NOT_FOUND()
  return rows[0]
}

async function openRevision(c: PoolClient | null, barId: string) {
  const sql = `SELECT id, status, snapshot, review_comment, submitted_at, updated_at, base_version FROM bar_revisions
               WHERE bar_id = $1 AND status IN ('draft', 'pending_review', 'changes_requested')`
  const { rows } = c ? await c.query<RevisionRow>(sql, [barId]) : await query<RevisionRow>(sql, [barId])
  return rows[0] ?? null
}

/** Datos vigentes (fila de bars + horarios + servicios + fotos públicas). */
export async function loadLive(c: PoolClient | null, bar: BarRow) {
  const q = <T extends Record<string, unknown>>(sql: string, p: unknown[]) => (c ? c.query<T>(sql, p) : query<T>(sql, p))
  // Consultas en serie: un cliente pg de transacción no admite consultas concurrentes.
  const hours = await q<{ day_of_week: number; is_closed: boolean; opens: string | null; closes: string | null }>(
    `SELECT day_of_week, is_closed, to_char(opening_time, 'HH24:MI') AS opens, to_char(closing_time, 'HH24:MI') AS closes
     FROM bar_hours WHERE bar_id = $1`, [bar.id])
  const amenities = await q<{ amenity_id: number }>(`SELECT amenity_id FROM bar_amenities WHERE bar_id = $1`, [bar.id])
  const images = await q<{ id: string; image_url: string; thumb_url: string | null }>(
    `SELECT id, image_url, thumb_url FROM bar_images WHERE bar_id = $1 AND revision_id IS NULL ORDER BY is_cover DESC, sort_order`, [bar.id])
  const byDay = new Map(hours.rows.map((h) => [h.day_of_week, h]))
  const social = (bar.social_links ?? {}) as Record<string, string>
  const data: BarFields = {
    name: bar.name as string,
    description: (bar.description as string) ?? '',
    categoryId: (bar.category_id as number) ?? null,
    typeId: (bar.type_id as number) ?? null,
    country: (bar.country as string) ?? 'MX',
    state: (bar.state as string) ?? '',
    city: (bar.city as string) ?? '',
    neighborhood: (bar.neighborhood as string) ?? '',
    address: (bar.address as string) ?? '',
    postalCode: (bar.postal_code as string) ?? '',
    latitude: bar.latitude == null ? null : Number(bar.latitude),
    longitude: bar.longitude == null ? null : Number(bar.longitude),
    phone: (bar.phone as string) ?? '',
    website: (bar.website as string) ?? '',
    social: { instagram: social.instagram ?? '', facebook: social.facebook ?? '', tiktok: social.tiktok ?? '' },
    priceRange: (bar.price_range as number) ?? null,
    hours: Array.from({ length: 7 }, (_, d) => {
      const h = byDay.get(d)
      return h ? { dayOfWeek: d, isClosed: h.is_closed, opens: h.opens, closes: h.closes } : { dayOfWeek: d, isClosed: true, opens: null, closes: null }
    }),
    amenityIds: amenities.rows.map((a) => a.amenity_id).sort((a, b) => a - b),
  }
  const imgs: WorkingImage[] = images.rows.map((i) => ({ id: i.id, url: i.image_url, thumbUrl: i.thumb_url ?? i.image_url }))
  return { data, images: imgs }
}

export async function resolveImages(c: PoolClient | null, barId: string, ids: string[]) {
  if (!ids.length) return []
  const sql = `SELECT id, image_url, thumb_url FROM bar_images WHERE bar_id = $1 AND id = ANY($2::uuid[])`
  const { rows } = c ? await c.query(sql, [barId, ids]) : await query(sql, [barId, ids])
  const byId = new Map(rows.map((r) => [r.id as string, r]))
  return ids.filter((id) => byId.has(id)).map((id) => {
    const r = byId.get(id)!
    return { id, url: r.image_url as string, thumbUrl: (r.thumb_url as string) ?? (r.image_url as string) }
  })
}

const isLiveEditable = (s: BarRow['publication_status']) => s === 'draft' || s === 'changes_requested' || s === 'rejected'

function lockReason(bar: BarRow, rev: RevisionRow | null): string | null {
  if (bar.publication_status === 'pending_review') return 'Tu establecimiento está en revisión. Podrás editarlo cuando tengamos una respuesta.'
  if (bar.publication_status === 'suspended') return 'Esta publicación está suspendida. Contacta a soporte para reactivarla.'
  if (rev?.status === 'pending_review') return 'Tus cambios están en revisión. La versión actual sigue visible mientras tanto.'
  return null
}

/** JSON con claves ordenadas: JSONB reordena las claves al guardarlas. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(v ?? null)
}

/** Campos que cambiaron entre la versión vigente y la propuesta. */
export function diffFields(live: BarFields & { imageIds: string[] }, next: BarFields & { imageIds: string[] }) {
  return (Object.keys(next) as (keyof typeof next)[]).filter((k) => stable(live[k]) !== stable(next[k]))
}

// ---------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------
export async function listOwnerBars(ownerId: string) {
  const { rows } = await query(
    `SELECT b.id, b.slug, b.name, b.city, b.neighborhood, b.publication_status AS status, b.moderation_note AS "moderationNote",
            b.submitted_at AS "submittedAt", b.published_at AS "publishedAt", b.updated_at AS "updatedAt",
            c.name AS category,
            (SELECT coalesce(thumb_url, image_url) FROM bar_images i WHERE i.bar_id = b.id AND i.revision_id IS NULL
             ORDER BY is_cover DESC, sort_order LIMIT 1) AS "coverUrl",
            r.status AS "revisionStatus", r.review_comment AS "revisionComment",
            coalesce((SELECT sum(views) FROM bar_daily_stats s WHERE s.bar_id = b.id AND s.day > current_date - 30), 0)::int AS "views30d"
     FROM bars b
     LEFT JOIN categories c ON c.id = b.category_id
     LEFT JOIN bar_revisions r ON r.bar_id = b.id AND r.status IN ('draft', 'pending_review', 'changes_requested')
     WHERE b.owner_id = $1 AND b.deleted_at IS NULL
     ORDER BY b.updated_at DESC`,
    [ownerId],
  )
  return rows
}

export async function getWorkingCopy(barId: string, ownerId: string) {
  const { rows } = await query<BarRow>(`SELECT * FROM bars WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [barId, ownerId])
  const bar = rows[0]
  if (!bar) throw NOT_FOUND()
  const rev = bar.publication_status === 'published' ? await openRevision(null, bar.id) : null

  let data: BarFields
  let images: WorkingImage[]
  if (rev) {
    const { imageIds, ...fields } = rev.snapshot
    data = fields
    images = await resolveImages(null, bar.id, imageIds)
  } else {
    ;({ data, images } = await loadLive(null, bar))
  }

  // Posibles duplicados: otros bares PUBLICADOS (info pública) o del mismo propietario.
  const dupes = data.name && data.city
    ? (await query(
        `SELECT b.name, b.city, b.slug, b.publication_status = 'published' AS "isPublished", b.owner_id = $3 AS "isOwn"
         FROM bars b WHERE b.id <> $1 AND b.deleted_at IS NULL AND lower(b.name) = lower($2) AND lower(b.city) = lower($4)
           AND (b.owner_id = $3 OR b.publication_status = 'published') LIMIT 5`,
        [bar.id, data.name, ownerId, data.city],
      )).rows
    : []

  return {
    bar: {
      id: bar.id,
      slug: bar.slug,
      status: bar.publication_status,
      moderationNote: bar.moderation_note,
      submittedAt: bar.submitted_at,
      publishedAt: bar.published_at,
      updatedAt: bar.updated_at,
    },
    revision: rev ? { id: rev.id, status: rev.status, reviewComment: rev.review_comment, submittedAt: rev.submitted_at, updatedAt: rev.updated_at } : null,
    data,
    images,
    lockReason: lockReason(bar, rev),
    duplicates: dupes,
  }
}

// ---------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------
export async function createBar(ownerId: string, name: string) {
  return withTx(async (c) => {
    const { rows } = await c.query(`SELECT count(*)::int AS n FROM bars WHERE owner_id = $1 AND deleted_at IS NULL`, [ownerId])
    if (rows[0].n >= MAX_BARS_PER_OWNER) throw new HttpError(409, `Alcanzaste el máximo de ${MAX_BARS_PER_OWNER} establecimientos`, 'limit_reached')
    const slug = await uniqueSlug(c, slugify(name))
    const { rows: created } = await c.query(
      `INSERT INTO bars (owner_id, name, slug, publication_status) VALUES ($1, $2, $3, 'draft') RETURNING id`,
      [ownerId, name, slug],
    )
    const id = created[0].id as string
    // Horario inicial: todos los días cerrados (el propietario los abre).
    await c.query(`INSERT INTO bar_hours (bar_id, day_of_week, is_closed) SELECT $1, d, true FROM generate_series(0, 6) d`, [id])
    return id
  })
}

/** Comprueba que categoría, tipo y servicios existan y estén activos (evita FK 500 y catálogos ocultos). */
export async function checkCatalog(c: PoolClient, d: BarFields) {
  const errors: Record<string, string> = {}
  if (d.categoryId && !(await c.query(`SELECT 1 FROM categories WHERE id = $1 AND is_active`, [d.categoryId])).rowCount) errors.categoryId = 'Categoría no válida'
  if (d.typeId && !(await c.query(`SELECT 1 FROM establishment_types WHERE id = $1 AND is_active`, [d.typeId])).rowCount) errors.typeId = 'Tipo no válido'
  if (d.amenityIds.length) {
    const { rows } = await c.query(`SELECT id FROM amenities WHERE id = ANY($1::int[]) AND is_active`, [d.amenityIds])
    if (rows.length !== new Set(d.amenityIds).size) errors.amenityIds = 'Hay servicios no válidos'
  }
  if (Object.keys(errors).length) throw new HttpError(422, 'Hay datos que revisar', 'validation_error', Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, [v]])))
  return { ...d, amenityIds: [...new Set(d.amenityIds)].sort((a, b) => a - b) }
}

export async function writeLive(c: PoolClient, bar: BarRow, d: BarFields) {
  // Mientras nunca se haya publicado, el slug sigue al nombre.
  const slug = bar.published_at ? bar.slug : await uniqueSlug(c, slugify(d.name || 'bar'), bar.id)
  await c.query(
    `UPDATE bars SET name = $2, slug = $3, description = $4, category_id = $5, type_id = $6, country = $7, state = $8, city = $9,
       neighborhood = $10, address = $11, postal_code = $12, latitude = $13, longitude = $14, phone = $15, website = $16,
       social_links = $17, price_range = $18
     WHERE id = $1`,
    [
      bar.id, d.name || bar.name, slug, d.description || null, d.categoryId, d.typeId, d.country, d.state || null, d.city || null,
      d.neighborhood || null, d.address || null, d.postalCode || null, d.latitude, d.longitude, d.phone || null, d.website || null,
      JSON.stringify(Object.fromEntries(Object.entries(d.social).filter(([, v]) => v))), d.priceRange,
    ],
  )
  await c.query(`DELETE FROM bar_hours WHERE bar_id = $1`, [bar.id])
  for (const h of d.hours) {
    await c.query(`INSERT INTO bar_hours (bar_id, day_of_week, opening_time, closing_time, is_closed) VALUES ($1, $2, $3, $4, $5)`, [
      bar.id, h.dayOfWeek, h.isClosed ? null : h.opens, h.isClosed ? null : h.closes, h.isClosed || !h.opens || !h.closes,
    ])
  }
  await c.query(`DELETE FROM bar_amenities WHERE bar_id = $1`, [bar.id])
  if (d.amenityIds.length) {
    await c.query(`INSERT INTO bar_amenities (bar_id, amenity_id) SELECT $1, unnest($2::int[])`, [bar.id, d.amenityIds])
  }
}

/** Revisión abierta del bar publicado; si no existe, se crea copiando la versión vigente. */
async function ensureRevision(c: PoolClient, bar: BarRow, authorId: string) {
  const rev = await openRevision(c, bar.id)
  if (rev) {
    if (rev.status === 'pending_review') throw new HttpError(409, lockReason(bar, rev)!, 'locked')
    return rev
  }
  const live = await loadLive(c, bar)
  const snapshot = { ...live.data, imageIds: live.images.map((i) => i.id) }
  const { rows } = await c.query<RevisionRow>(
    `INSERT INTO bar_revisions (bar_id, author_id, base_version, status, snapshot) VALUES ($1, $2, $3, 'draft', $4)
     RETURNING id, status, snapshot, review_comment, submitted_at, updated_at, base_version`,
    [bar.id, authorId, bar.version, JSON.stringify(snapshot)],
  )
  return rows[0]
}

function assertEditable(bar: BarRow) {
  if (bar.publication_status === 'pending_review' || bar.publication_status === 'suspended') {
    throw new HttpError(409, lockReason(bar, null)!, 'locked')
  }
}

export async function saveDraft(barId: string, ownerId: string, input: BarFields) {
  await withTx(async (c) => {
    const bar = await lockBar(c, barId, ownerId)
    assertEditable(bar)
    const d = await checkCatalog(c, input)
    if (isLiveEditable(bar.publication_status)) {
      await writeLive(c, bar, d)
    } else {
      const rev = await ensureRevision(c, bar, ownerId)
      await c.query(`UPDATE bar_revisions SET snapshot = $2 WHERE id = $1`, [rev.id, JSON.stringify({ ...d, imageIds: rev.snapshot.imageIds })])
    }
    await c.query(`UPDATE bars SET updated_at = now() WHERE id = $1`, [bar.id])
  })
  return getWorkingCopy(barId, ownerId)
}

export async function submitForReview(barId: string, ownerId: string) {
  await withTx(async (c) => {
    const bar = await lockBar(c, barId, ownerId)
    assertEditable(bar)
    if (isLiveEditable(bar.publication_status)) {
      const { data, images } = await loadLive(c, bar)
      const errors = validateForSubmit(data, images)
      if (Object.keys(errors).length) throw new HttpError(422, 'Completa la información antes de enviar', 'incomplete', Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, [v]])))
      // Portada = primera foto.
      await c.query(`UPDATE bar_images SET is_cover = false WHERE bar_id = $1`, [bar.id])
      await c.query(`UPDATE bar_images SET is_cover = true WHERE id = $1`, [images[0].id])
      await c.query(`UPDATE bars SET publication_status = 'pending_review', submitted_at = now() WHERE id = $1`, [bar.id])
    } else {
      const rev = await openRevision(c, bar.id)
      if (!rev) throw new HttpError(422, 'No hay cambios para enviar', 'no_changes')
      if (rev.status === 'pending_review') throw new HttpError(409, lockReason(bar, rev)!, 'locked')
      const { imageIds, ...fields } = rev.snapshot
      const images = await resolveImages(c, bar.id, imageIds)
      const errors = validateForSubmit(fields, images)
      if (Object.keys(errors).length) throw new HttpError(422, 'Completa la información antes de enviar', 'incomplete', Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, [v]])))
      const live = await loadLive(c, bar)
      const changed = diffFields({ ...live.data, imageIds: live.images.map((i) => i.id) }, rev.snapshot)
      if (!changed.length) throw new HttpError(422, 'No hay cambios respecto a la versión publicada', 'no_changes')
      await c.query(`UPDATE bar_revisions SET status = 'pending_review', submitted_at = now(), changed_fields = $2 WHERE id = $1`, [rev.id, changed])
    }
    await c.query(`UPDATE bars SET updated_at = now() WHERE id = $1`, [bar.id])
  })
  return getWorkingCopy(barId, ownerId)
}

/** Borra un establecimiento que nunca se publicó. */
export async function deleteDraftBar(barId: string, ownerId: string) {
  const keys = await withTx(async (c) => {
    const bar = await lockBar(c, barId, ownerId)
    if (bar.published_at || !isLiveEditable(bar.publication_status)) {
      throw new HttpError(409, 'Solo puedes eliminar establecimientos que nunca se han publicado', 'not_deletable')
    }
    const { rows } = await c.query(`SELECT storage_key FROM bar_images WHERE bar_id = $1`, [bar.id])
    await c.query(`DELETE FROM bars WHERE id = $1`, [bar.id])
    return rows.map((r) => r.storage_key as string)
  })
  await Promise.all(keys.map(removeStored))
}

/** Descarta los cambios no enviados (o con cambios solicitados) de un bar publicado. */
export async function discardRevision(barId: string, ownerId: string) {
  const keys = await withTx(async (c) => {
    const bar = await lockBar(c, barId, ownerId)
    const rev = await openRevision(c, bar.id)
    if (!rev) throw new HttpError(404, 'No hay cambios pendientes', 'not_found')
    if (rev.status === 'pending_review') throw new HttpError(409, 'No puedes descartar cambios que están en revisión', 'locked')
    const { rows } = await c.query(`SELECT storage_key FROM bar_images WHERE revision_id = $1`, [rev.id])
    await c.query(`DELETE FROM bar_revisions WHERE id = $1`, [rev.id])
    return rows.map((r) => r.storage_key as string)
  })
  await Promise.all(keys.map(removeStored))
}

// ---------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------
/** Verifica permisos y cupo antes de procesar la imagen (evita trabajo inútil). */
export async function assertCanAddImage(barId: string, ownerId: string) {
  const wc = await getWorkingCopy(barId, ownerId)
  if (wc.lockReason) throw new HttpError(409, wc.lockReason, 'locked')
  if (wc.images.length >= MAX_IMAGES) throw new HttpError(409, `Puedes subir hasta ${MAX_IMAGES} fotos`, 'too_many_images')
}

export async function addImage(barId: string, ownerId: string, img: { imageUrl: string; thumbUrl: string; storageKey: string; width: number; height: number }) {
  return withTx(async (c) => {
    const bar = await lockBar(c, barId, ownerId)
    assertEditable(bar)
    if (isLiveEditable(bar.publication_status)) {
      const { rows } = await c.query(`SELECT count(*)::int AS n, coalesce(max(sort_order), -1) AS max FROM bar_images WHERE bar_id = $1 AND revision_id IS NULL`, [bar.id])
      if (rows[0].n >= MAX_IMAGES) throw new HttpError(409, `Puedes subir hasta ${MAX_IMAGES} fotos`, 'too_many_images')
      const ins = await c.query(
        `INSERT INTO bar_images (bar_id, storage_key, image_url, thumb_url, width, height, is_cover, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [bar.id, img.storageKey, img.imageUrl, img.thumbUrl, img.width, img.height, rows[0].n === 0, rows[0].max + 1],
      )
      return ins.rows[0].id as string
    }
    const rev = await ensureRevision(c, bar, ownerId)
    if (rev.snapshot.imageIds.length >= MAX_IMAGES) throw new HttpError(409, `Puedes subir hasta ${MAX_IMAGES} fotos`, 'too_many_images')
    const ins = await c.query(
      `INSERT INTO bar_images (bar_id, revision_id, storage_key, image_url, thumb_url, width, height, is_cover, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, 0) RETURNING id`,
      [bar.id, rev.id, img.storageKey, img.imageUrl, img.thumbUrl, img.width, img.height],
    )
    const id = ins.rows[0].id as string
    await c.query(`UPDATE bar_revisions SET snapshot = jsonb_set(snapshot, '{imageIds}', $2::jsonb) WHERE id = $1`, [rev.id, JSON.stringify([...rev.snapshot.imageIds, id])])
    return id
  })
}

export async function reorderImages(barId: string, ownerId: string, ids: string[]) {
  await withTx(async (c) => {
    const bar = await lockBar(c, barId, ownerId)
    assertEditable(bar)
    if (isLiveEditable(bar.publication_status)) {
      const { rows } = await c.query(`SELECT id FROM bar_images WHERE bar_id = $1 AND revision_id IS NULL`, [bar.id])
      const current = new Set(rows.map((r) => r.id as string))
      if (ids.length !== current.size || !ids.every((id) => current.has(id))) throw new HttpError(422, 'El orden no coincide con las fotos actuales', 'invalid_order')
      await c.query(`UPDATE bar_images SET is_cover = false WHERE bar_id = $1`, [bar.id])
      for (const [i, id] of ids.entries()) {
        await c.query(`UPDATE bar_images SET sort_order = $2, is_cover = $3 WHERE id = $1`, [id, i, i === 0])
      }
    } else {
      const rev = await ensureRevision(c, bar, ownerId)
      const current = new Set(rev.snapshot.imageIds)
      if (ids.length !== current.size || !ids.every((id) => current.has(id))) throw new HttpError(422, 'El orden no coincide con las fotos actuales', 'invalid_order')
      await c.query(`UPDATE bar_revisions SET snapshot = jsonb_set(snapshot, '{imageIds}', $2::jsonb) WHERE id = $1`, [rev.id, JSON.stringify(ids)])
    }
  })
}

export async function deleteImage(barId: string, ownerId: string, imageId: string) {
  const key = await withTx(async (c) => {
    const bar = await lockBar(c, barId, ownerId)
    assertEditable(bar)
    const { rows } = await c.query(`SELECT id, storage_key, revision_id FROM bar_images WHERE id = $1 AND bar_id = $2`, [imageId, bar.id])
    const img = rows[0]
    if (!img) throw new HttpError(404, 'Foto no encontrada', 'not_found')
    if (isLiveEditable(bar.publication_status)) {
      if (img.revision_id) throw new HttpError(404, 'Foto no encontrada', 'not_found')
      await c.query(`DELETE FROM bar_images WHERE id = $1`, [imageId])
      // Si era la portada, la siguiente pasa a serlo.
      await c.query(
        `UPDATE bar_images SET is_cover = true WHERE id = (SELECT id FROM bar_images WHERE bar_id = $1 AND revision_id IS NULL ORDER BY sort_order LIMIT 1)
         AND NOT EXISTS (SELECT 1 FROM bar_images WHERE bar_id = $1 AND is_cover)`,
        [bar.id],
      )
      return img.storage_key as string
    }
    const rev = await ensureRevision(c, bar, ownerId)
    if (!rev.snapshot.imageIds.includes(imageId)) throw new HttpError(404, 'Foto no encontrada', 'not_found')
    await c.query(`UPDATE bar_revisions SET snapshot = jsonb_set(snapshot, '{imageIds}', $2::jsonb) WHERE id = $1`, [rev.id, JSON.stringify(rev.snapshot.imageIds.filter((i) => i !== imageId))])
    // Una foto nueva de la revisión se borra ya; una foto pública solo deja de estar en la propuesta.
    if (img.revision_id === rev.id) {
      await c.query(`DELETE FROM bar_images WHERE id = $1`, [imageId])
      return img.storage_key as string
    }
    return null
  })
  if (key) await removeStored(key)
}

// ---------------------------------------------------------------------
// Resumen del panel
// ---------------------------------------------------------------------
export async function ownerOverview(ownerId: string) {
  const [counts, revisions, views, activity] = await Promise.all([
    query(`SELECT publication_status AS status, count(*)::int AS n FROM bars WHERE owner_id = $1 AND deleted_at IS NULL GROUP BY 1`, [ownerId]),
    query(
      `SELECT r.status, count(*)::int AS n FROM bar_revisions r JOIN bars b ON b.id = r.bar_id
       WHERE b.owner_id = $1 AND r.status IN ('pending_review', 'changes_requested') GROUP BY 1`, [ownerId]),
    query(
      `SELECT coalesce(sum(s.views), 0)::int AS views FROM bar_daily_stats s JOIN bars b ON b.id = s.bar_id
       WHERE b.owner_id = $1 AND s.day > current_date - 30`, [ownerId]),
    query(`SELECT id, type, title, body, link, read_at AS "readAt", created_at AS "createdAt" FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 6`, [ownerId]),
  ])
  const byStatus = Object.fromEntries(counts.rows.map((r) => [r.status, r.n]))
  const revs = Object.fromEntries(revisions.rows.map((r) => [r.status, r.n]))
  const total = counts.rows.reduce((a, r) => a + r.n, 0)
  return {
    total,
    published: byStatus.published ?? 0,
    pending: (byStatus.pending_review ?? 0) + (revs.pending_review ?? 0),
    changesRequested: (byStatus.changes_requested ?? 0) + (byStatus.rejected ?? 0) + (revs.changes_requested ?? 0),
    drafts: byStatus.draft ?? 0,
    views30d: views.rows[0].views,
    activity: activity.rows,
  }
}
