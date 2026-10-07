import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, HttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { favoriteBars, favoriteIds, listNotifications, markNotificationsRead, setFavorite } from '../services/engagement.js'

/** /api/me — datos del usuario con sesión (cualquier rol). */
export const meRouter = Router()
meRouter.use(requireAuth, (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

const uuid = z.uuid()

meRouter.get('/favorites', asyncHandler(async (req, res) => {
  const q = z.object({ lat: z.coerce.number().min(-90).max(90).optional(), lng: z.coerce.number().min(-180).max(180).optional() }).parse(req.query)
  const coords = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined
  res.json({ items: await favoriteBars(req.user!.id, coords) })
}))

meRouter.get('/favorites/ids', asyncHandler(async (req, res) => {
  res.json({ ids: await favoriteIds(req.user!.id) })
}))

meRouter.put('/favorites/:barId', asyncHandler(async (req, res) => {
  const id = uuid.safeParse(req.params.barId)
  if (!id.success) throw new HttpError(404, 'Este bar no está disponible', 'not_found')
  await setFavorite(req.user!.id, id.data, true)
  res.json({ ok: true })
}))

meRouter.delete('/favorites/:barId', asyncHandler(async (req, res) => {
  const id = uuid.safeParse(req.params.barId)
  if (!id.success) throw new HttpError(404, 'Este bar no está disponible', 'not_found')
  await setFavorite(req.user!.id, id.data, false)
  res.json({ ok: true })
}))

meRouter.get('/notifications', asyncHandler(async (req, res) => {
  res.json(await listNotifications(req.user!.id))
}))

meRouter.post('/notifications/read', asyncHandler(async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.uuid()).max(100).optional() }).strict().parse(req.body ?? {})
  await markNotificationsRead(req.user!.id, ids)
  res.json(await listNotifications(req.user!.id))
}))
