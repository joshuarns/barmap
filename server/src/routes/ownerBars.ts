import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { config } from '../config.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import { processAndStore, removeStored } from '../lib/images.js'
import { line } from '../lib/validation.js'
import { requireOwner } from '../middleware/auth.js'
import { limits } from '../middleware/security.js'
import {
  addImage, assertCanAddImage, createBar, deleteDraftBar, deleteImage, discardRevision, draftSchema, getWorkingCopy,
  listOwnerBars, ownerOverview, reorderImages, saveDraft, submitForReview,
} from '../services/ownerBars.js'
import { ownerStats } from '../services/engagement.js'

/** /api/owner/* — solo propietarios aprobados. */
export const ownerBarsRouter = Router()
ownerBarsRouter.use(requireOwner)

const uuid = z.uuid()
const barId = (raw: string | string[] | undefined) => {
  const r = uuid.safeParse(raw)
  if (!r.success) throw new HttpError(404, 'Establecimiento no encontrado', 'not_found')
  return r.data
}

ownerBarsRouter.get('/overview', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(await ownerOverview(req.user!.id))
}))

ownerBarsRouter.get('/stats', asyncHandler(async (req, res) => {
  const { days } = z.object({ days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d)).default(30) }).parse(req.query)
  res.set('Cache-Control', 'no-store')
  res.json(await ownerStats(req.user!.id, days))
}))

ownerBarsRouter.get('/bars', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ items: await listOwnerBars(req.user!.id) })
}))

ownerBarsRouter.post('/bars', limits.createBar, asyncHandler(async (req, res) => {
  const { name } = z.object({ name: line(2, 80) }).strict().parse(req.body)
  const id = await createBar(req.user!.id, name)
  res.status(201).json(await getWorkingCopy(id, req.user!.id))
}))

ownerBarsRouter.get('/bars/:id', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(await getWorkingCopy(barId(req.params.id), req.user!.id))
}))

ownerBarsRouter.put('/bars/:id', asyncHandler(async (req, res) => {
  const data = draftSchema.parse(req.body)
  res.json(await saveDraft(barId(req.params.id), req.user!.id, data))
}))

ownerBarsRouter.post('/bars/:id/submit', asyncHandler(async (req, res) => {
  res.json(await submitForReview(barId(req.params.id), req.user!.id))
}))

ownerBarsRouter.delete('/bars/:id', asyncHandler(async (req, res) => {
  await deleteDraftBar(barId(req.params.id), req.user!.id)
  res.json({ ok: true })
}))

ownerBarsRouter.delete('/bars/:id/revision', asyncHandler(async (req, res) => {
  await discardRevision(barId(req.params.id), req.user!.id)
  res.json(await getWorkingCopy(barId(req.params.id), req.user!.id))
}))

// --- Fotos -----------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1, fields: 0 },
})

ownerBarsRouter.post(
  '/bars/:id/images',
  limits.upload,
  asyncHandler(async (req, res) => {
    const id = barId(req.params.id)
    // Permisos y cupo ANTES de leer el archivo.
    await assertCanAddImage(id, req.user!.id)
    await new Promise<void>((resolve, reject) => upload.single('image')(req, res, (err) => (err ? reject(err) : resolve())))
    if (!req.file) throw new HttpError(422, 'Adjunta una imagen', 'no_file')
    const stored = await processAndStore(req.file.buffer, id)
    try {
      await addImage(id, req.user!.id, stored)
    } catch (err) {
      await removeStored(stored.storageKey)
      throw err
    }
    res.status(201).json(await getWorkingCopy(id, req.user!.id))
  }),
)

ownerBarsRouter.put('/bars/:id/images/order', asyncHandler(async (req, res) => {
  const { imageIds } = z.object({ imageIds: z.array(z.uuid()).max(30) }).strict().parse(req.body)
  await reorderImages(barId(req.params.id), req.user!.id, imageIds)
  res.json(await getWorkingCopy(barId(req.params.id), req.user!.id))
}))

ownerBarsRouter.delete('/bars/:id/images/:imageId', asyncHandler(async (req, res) => {
  const imageId = uuid.safeParse(req.params.imageId)
  if (!imageId.success) throw new HttpError(404, 'Foto no encontrada', 'not_found')
  await deleteImage(barId(req.params.id), req.user!.id, imageId.data)
  res.json(await getWorkingCopy(barId(req.params.id), req.user!.id))
}))

