import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, HttpError } from '../lib/http.js'
import { getBarBySlug, getCatalog, searchBars } from '../services/publicBars.js'
import { createReport, recordEvent, visitorHash } from '../services/engagement.js'
import { multiline } from '../lib/validation.js'
import { isBot, limits } from '../middleware/security.js'

export const publicRouter = Router()

/** "a,b,c" → ["a","b","c"]; ignora vacíos. */
const csvList = z
  .string()
  .max(400)
  .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))

const csvNumbers = (min: number, max: number, maxItems: number) =>
  csvList.pipe(z.array(z.coerce.number<string>().min(min).max(max)).max(maxItems))

const slugList = csvList.pipe(z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(12))

const searchSchema = z.object({
  q: z.string().trim().max(80).optional().transform((v) => v || undefined),
  donde: z.string().trim().max(80).optional().transform((v) => v || undefined),
  categoria: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
  precio: csvNumbers(1, 4, 4).optional(),
  servicios: slugList.optional(),
  abierto: z.enum(['1', 'true']).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radio: z.coerce.number().min(0.5).max(50).optional(),
  bbox: csvNumbers(-180, 180, 4).refine((a) => a.length === 4, 'bbox requiere 4 valores').optional(),
  orden: z.enum(['relevance', 'distance', 'popular', 'recommended', 'newest']).default('relevance'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
})

publicRouter.get(
  '/bars',
  asyncHandler(async (req, res) => {
    const s = searchSchema.parse(req.query)
    const result = await searchBars({
      q: s.q,
      where: s.donde,
      category: s.categoria,
      prices: s.precio,
      amenities: s.servicios,
      openNow: Boolean(s.abierto),
      lat: s.lat !== undefined && s.lng !== undefined ? s.lat : undefined,
      lng: s.lat !== undefined && s.lng !== undefined ? s.lng : undefined,
      radiusKm: s.radio,
      bbox: s.bbox as [number, number, number, number] | undefined,
      sort: s.orden,
      page: s.page,
      pageSize: s.pageSize,
    })
    res.set('Cache-Control', 'public, max-age=30')
    res.json(result)
  }),
)

publicRouter.get(
  '/bars/:slug',
  asyncHandler(async (req, res) => {
    const slug = z.string().regex(/^[a-z0-9-]{1,120}$/).safeParse(req.params.slug)
    if (!slug.success) throw new HttpError(404, 'Este bar no existe o ya no está disponible', 'not_found')
    const bar = await getBarBySlug(slug.data)
    // Borradores, pendientes o suspendidos responden igual que inexistentes.
    if (!bar) throw new HttpError(404, 'Este bar no existe o ya no está disponible', 'not_found')
    res.set('Cache-Control', 'public, max-age=60')
    res.json(bar)
  }),
)

publicRouter.get(
  '/catalog',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300')
    res.json(await getCatalog())
  }),
)

const slugSchema = z.string().regex(/^[a-z0-9-]{1,120}$/)

/** Visitas y clics (anónimos, deduplicados por día). Nunca falla de cara al usuario. */
publicRouter.post(
  '/bars/:slug/events',
  limits.events,
  asyncHandler(async (req, res) => {
    const slug = slugSchema.safeParse(req.params.slug)
    const body = z.object({ type: z.enum(['view', 'directions', 'share']) }).strict().safeParse(req.body)
    if (!slug.success || !body.success) throw new HttpError(422, 'Evento no válido', 'validation_error')
    await recordEvent(slug.data, body.data.type, visitorHash(req.ip, req.get('user-agent')))
    res.status(204).end()
  }),
)

publicRouter.post(
  '/bars/:slug/reports',
  limits.report,
  asyncHandler(async (req, res) => {
    if (isBot(req.body)) return res.status(201).json({ ok: true })
    const slug = slugSchema.safeParse(req.params.slug)
    if (!slug.success) throw new HttpError(404, 'Este bar no existe o ya no está disponible', 'not_found')
    const { website_url: _hp, ...body } = req.body ?? {}
    const data = z
      .object({
        reason: z.enum(['wrong_info', 'closed_permanently', 'inappropriate', 'duplicate', 'other']),
        details: multiline(1000).optional().default(''),
      })
      .strict()
      .refine((d) => d.reason !== 'other' || d.details.length >= 10, { message: 'Cuéntanos qué ocurre (mínimo 10 caracteres)', path: ['details'] })
      .parse(body)
    await createReport(slug.data, data, { userId: req.user?.id, hash: visitorHash(req.ip, req.get('user-agent')) })
    res.status(201).json({ ok: true })
  }),
)
