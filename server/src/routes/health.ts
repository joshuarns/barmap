import { Router } from 'express'
import { asyncHandler } from '../lib/http.js'
import { query } from '../db/pool.js'

export const healthRouter = Router()

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    let database = 'ok'
    try {
      await query('SELECT 1')
    } catch {
      database = 'unreachable'
    }
    res.status(database === 'ok' ? 200 : 503).json({ ok: database === 'ok', service: 'barmap-api', database })
  }),
)
