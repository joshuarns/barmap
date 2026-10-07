import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, HttpError } from '../lib/http.js'
import { line, multiline } from '../lib/validation.js'
import { draftSchema } from '../services/ownerBars.js'
import {
  adminEditBar, decideNewBar, decideRevision, listAllBars, moderationQueue, reviewDetail, setBarVisibility,
} from '../services/moderation.js'
import {
  CATALOGS, adminOverview, createCatalogItem, deleteCatalogItem, listCatalog, listLogs, listUsers, setUserStatus,
  updateCatalogItem, userDetail, type CatalogKind,
} from '../services/adminPlatform.js'
import { listReports, resolveReport, setBarVerified } from '../services/engagement.js'

/** Montado en /api/admin con requireRole('admin'). */
export const adminPlatformRouter = Router()

const uuid = z.uuid()
const idParam = (raw: unknown, what = 'Recurso') => {
  const r = uuid.safeParse(raw)
  if (!r.success) throw new HttpError(404, `${what} no encontrado`, 'not_found')
  return r.data
}
const paging = { page: z.coerce.number().int().min(1).max(1000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }
const search = z.string().trim().max(80).optional().transform((v) => v || undefined)

adminPlatformRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

adminPlatformRouter.get('/overview', asyncHandler(async (_req, res) => res.json(await adminOverview())))

// --- Moderación -------------------------------------------------------
adminPlatformRouter.get('/moderation', asyncHandler(async (req, res) => {
  const s = z.object({ kind: z.enum(['new', 'revision']).optional(), q: search, ...paging }).parse(req.query)
  res.json(await moderationQueue(s))
}))

adminPlatformRouter.get('/bars/:id', asyncHandler(async (req, res) => {
  res.json(await reviewDetail(idParam(req.params.id, 'Establecimiento')))
}))

const decisionSchema = z
  .object({
    target: z.enum(['bar', 'revision']),
    decision: z.enum(['approve', 'reject', 'request_changes']),
    comment: multiline(1500).optional().default(''),
  })
  .strict()
  .refine((d) => d.decision === 'approve' || d.comment.length >= 10, {
    message: 'Explica al propietario qué debe corregir (mínimo 10 caracteres)',
    path: ['comment'],
  })

adminPlatformRouter.post('/bars/:id/decision', asyncHandler(async (req, res) => {
  const id = idParam(req.params.id, 'Establecimiento')
  const d = decisionSchema.parse(req.body)
  if (d.target === 'bar') await decideNewBar(req.user!.id, id, d.decision, d.comment)
  else await decideRevision(req.user!.id, id, d.decision, d.comment)
  res.json(await reviewDetail(id))
}))

adminPlatformRouter.post('/bars/:id/visibility', asyncHandler(async (req, res) => {
  const id = idParam(req.params.id, 'Establecimiento')
  const d = z
    .object({ action: z.enum(['suspend', 'reactivate']), comment: multiline(1000).optional().default('') })
    .strict()
    .refine((x) => x.action === 'reactivate' || x.comment.length >= 10, { message: 'Explica el motivo (mínimo 10 caracteres)', path: ['comment'] })
    .parse(req.body)
  await setBarVisibility(req.user!.id, id, d.action, d.comment)
  res.json(await reviewDetail(id))
}))

adminPlatformRouter.put('/bars/:id', asyncHandler(async (req, res) => {
  const id = idParam(req.params.id, 'Establecimiento')
  const { comment, data } = z.object({ comment: multiline(500).optional().default(''), data: draftSchema }).strict().parse(req.body)
  await adminEditBar(req.user!.id, id, data, comment)
  res.json(await reviewDetail(id))
}))

adminPlatformRouter.get('/bars', asyncHandler(async (req, res) => {
  const s = z
    .object({
      status: z.enum(['draft', 'pending_review', 'published', 'changes_requested', 'rejected', 'suspended']).optional(),
      q: search,
      sort: z.enum(['updated', 'submitted', 'name', 'views']).default('updated'),
      ...paging,
    })
    .parse(req.query)
  res.json(await listAllBars(s))
}))

// --- Usuarios ---------------------------------------------------------
adminPlatformRouter.get('/users', asyncHandler(async (req, res) => {
  const s = z
    .object({
      role: z.enum(['visitor', 'owner', 'admin']).optional(),
      status: z.enum(['active', 'suspended']).optional(),
      q: search,
      sort: z.enum(['recent', 'name', 'bars']).default('recent'),
      ...paging,
    })
    .parse(req.query)
  res.json(await listUsers(s))
}))

adminPlatformRouter.get('/users/:id', asyncHandler(async (req, res) => {
  res.json(await userDetail(idParam(req.params.id, 'Usuario')))
}))

adminPlatformRouter.post('/users/:id/status', asyncHandler(async (req, res) => {
  const id = idParam(req.params.id, 'Usuario')
  const d = z
    .object({ action: z.enum(['suspend', 'reactivate']), reason: multiline(1000).optional().default('') })
    .strict()
    .refine((x) => x.action === 'reactivate' || x.reason.length >= 10, { message: 'Explica el motivo (mínimo 10 caracteres)', path: ['reason'] })
    .parse(req.body)
  await setUserStatus(req.user!.id, id, d.action, d.reason)
  res.json(await userDetail(id))
}))

// --- Catálogos --------------------------------------------------------
const kindParam = (raw: unknown) => {
  if (typeof raw !== 'string' || !(raw in CATALOGS)) throw new HttpError(404, 'Catálogo no encontrado', 'not_found')
  return raw as CatalogKind
}
const icon = z.string().regex(/^[a-z0-9-]{1,40}$/, 'Icono no válido').nullable().optional()

adminPlatformRouter.get('/catalog/:kind', asyncHandler(async (req, res) => {
  res.json({ items: await listCatalog(kindParam(req.params.kind)) })
}))

adminPlatformRouter.post('/catalog/:kind', asyncHandler(async (req, res) => {
  const kind = kindParam(req.params.kind)
  const d = z.object({ name: line(2, 60), icon }).strict().parse(req.body)
  const id = await createCatalogItem(req.user!.id, kind, d)
  res.status(201).json({ id, items: await listCatalog(kind) })
}))

adminPlatformRouter.patch('/catalog/:kind/:id', asyncHandler(async (req, res) => {
  const kind = kindParam(req.params.kind)
  const id = z.coerce.number().int().positive().parse(req.params.id)
  const d = z.object({ name: line(2, 60).optional(), icon, isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).max(1000).optional() }).strict().parse(req.body)
  await updateCatalogItem(req.user!.id, kind, id, d)
  res.json({ items: await listCatalog(kind) })
}))

adminPlatformRouter.delete('/catalog/:kind/:id', asyncHandler(async (req, res) => {
  const kind = kindParam(req.params.kind)
  const id = z.coerce.number().int().positive().parse(req.params.id)
  await deleteCatalogItem(req.user!.id, kind, id)
  res.json({ items: await listCatalog(kind) })
}))

// --- Historial --------------------------------------------------------
adminPlatformRouter.get('/logs', asyncHandler(async (req, res) => {
  const s = z
    .object({
      entityType: z.enum(['user', 'owner_application', 'bar', 'bar_revision', 'report', 'category', 'establishment_type', 'amenity']).optional(),
      action: z.string().regex(/^[a-z_]{2,30}$/).optional(),
      adminId: z.uuid().optional(),
      q: search,
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
      ...paging,
    })
    .parse(req.query)
  res.json(await listLogs(s))
}))

// --- Reportes y verificación (Etapa 6) --------------------------------
adminPlatformRouter.get('/reports', asyncHandler(async (req, res) => {
  const s = z.object({ status: z.enum(['open', 'resolved', 'dismissed']).optional(), ...paging }).parse(req.query)
  res.json(await listReports(s))
}))

adminPlatformRouter.post('/reports/:id/resolve', asyncHandler(async (req, res) => {
  const id = idParam(req.params.id, 'Reporte')
  const d = z.object({ action: z.enum(['resolve', 'dismiss']), note: multiline(1000).optional().default('') }).strict().parse(req.body)
  await resolveReport(req.user!.id, id, d.action, d.note)
  res.json({ ok: true })
}))

adminPlatformRouter.post('/bars/:id/verify', asyncHandler(async (req, res) => {
  const id = idParam(req.params.id, 'Establecimiento')
  const d = z.object({ verified: z.boolean(), note: multiline(500).optional().default('') }).strict().parse(req.body)
  await setBarVerified(req.user!.id, id, d.verified, d.note)
  res.json(await reviewDetail(id))
}))
