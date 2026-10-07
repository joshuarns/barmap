import { Router } from 'express'
import { z } from 'zod'
import { pool, query } from '../db/pool.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import { httpsUrl, line, multiline, phone } from '../lib/validation.js'
import { requireVerifiedEmail } from '../middleware/auth.js'
import { isBot, limits } from '../middleware/security.js'

export const ownerApplicationRouter = Router()

const applicationSchema = z
  .object({
    businessName: line(2, 160),
    contactPhone: phone,
    city: line(2, 80),
    role: z.enum(['owner', 'manager', 'marketing', 'other']),
    website: httpsUrl.optional().default(''),
    instagram: line(0, 60).optional().default(''),
    notes: multiline(2000).optional().default(''),
  })
  .strict()

/**
 * POST /api/owner/application
 * Requisitos: sesión, correo verificado, cuenta activa, rol 'visitor', sin
 * solicitud pendiente. Crea la solicitud en 'pending'; NUNCA cambia el rol.
 */
ownerApplicationRouter.post(
  '/application',
  requireVerifiedEmail,
  limits.application,
  asyncHandler(async (req, res) => {
    const user = req.user!
    if (isBot(req.body)) return res.status(201).json({ ok: true })
    const { website_url: _hp, ...body } = req.body ?? {}
    const data = applicationSchema.parse(body)

    if (user.accountStatus !== 'active') throw new HttpError(403, 'Tu cuenta está suspendida', 'account_suspended')
    if (user.role !== 'visitor') throw new HttpError(409, 'Tu cuenta ya tiene acceso de gestión', 'already_owner')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // Bloquea al usuario para evitar dos solicitudes simultáneas.
      await client.query(`SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, [user.id])
      const pending = await client.query(`SELECT 1 FROM owner_applications WHERE user_id = $1 AND application_status = 'pending'`, [user.id])
      if (pending.rowCount) throw new HttpError(409, 'Ya tienes una solicitud en revisión', 'application_pending')

      const { rows } = await client.query(
        `INSERT INTO owner_applications (user_id, business_name, contact_phone, application_notes, verification_data)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, application_status, created_at`,
        [
          user.id, data.businessName, data.contactPhone, data.notes || null,
          JSON.stringify({ city: data.city, role: data.role, website: data.website || null, instagram: data.instagram || null }),
        ],
      )
      await client.query('COMMIT')
      res.status(201).json({ application: { id: rows[0].id, status: rows[0].application_status, createdAt: rows[0].created_at } })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }),
)

/** Historial de solicitudes del propio usuario (con motivo de rechazo). */
ownerApplicationRouter.get(
  '/application',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Inicia sesión para continuar', 'unauthenticated')
    const { rows } = await query(
      `SELECT id, application_status AS status, business_name AS "businessName", contact_phone AS "contactPhone",
              application_notes AS notes, verification_data AS details, rejection_reason AS "rejectionReason",
              created_at AS "createdAt", reviewed_at AS "reviewedAt"
       FROM owner_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [req.user.id],
    )
    res.set('Cache-Control', 'no-store')
    res.json({ applications: rows })
  }),
)
