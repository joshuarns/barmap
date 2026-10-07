import { Router } from 'express'
import { z } from 'zod'
import { pool, query } from '../db/pool.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import { Params, likeEscape } from '../lib/query.js'
import { multiline } from '../lib/validation.js'
import { appLink, sendMail } from '../lib/mailer.js'
import { logModeration, notify } from '../services/audit.js'

/** Montado bajo /api/admin con requireRole('admin'). */
export const adminApplicationsRouter = Router()

const listSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

adminApplicationsRouter.get(
  '/applications',
  asyncHandler(async (req, res) => {
    const s = listSchema.parse(req.query)
    const p = new Params()
    const where: string[] = []
    if (s.status) where.push(`a.application_status = ${p.add(s.status)}`)
    if (s.q) {
      const like = p.add(`%${likeEscape(s.q)}%`)
      where.push(`(u.name ILIKE ${like} OR u.email::text ILIKE ${like} OR a.business_name ILIKE ${like})`)
    }
    const { rows } = await query(
      `SELECT a.id, a.application_status AS status, a.business_name AS "businessName", a.created_at AS "createdAt",
              a.reviewed_at AS "reviewedAt", a.verification_data->>'city' AS city,
              u.id AS "userId", u.name, u.email, u.account_status AS "accountStatus",
              (SELECT count(*)::int FROM bars b WHERE b.owner_id = u.id AND b.deleted_at IS NULL) AS "barCount",
              count(*) OVER() AS total
       FROM owner_applications a JOIN users u ON u.id = a.user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY (a.application_status = 'pending') DESC,
                CASE WHEN a.application_status = 'pending' THEN a.created_at END ASC,
                a.created_at DESC
       LIMIT ${p.add(s.pageSize)} OFFSET ${p.add((s.page - 1) * s.pageSize)}`,
      p.values,
    )
    const counts = await query(
      `SELECT application_status AS status, count(*)::int AS n FROM owner_applications GROUP BY application_status`,
    )
    const total = rows.length ? Number(rows[0].total) : 0
    res.set('Cache-Control', 'no-store')
    res.json({
      items: rows.map(({ total: _t, ...r }) => r),
      page: s.page,
      pageSize: s.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / s.pageSize)),
      counts: Object.fromEntries(counts.rows.map((c) => [c.status, c.n])),
    })
  }),
)

const uuid = z.uuid()

adminApplicationsRouter.get(
  '/applications/:id',
  asyncHandler(async (req, res) => {
    const id = uuid.safeParse(req.params.id)
    if (!id.success) throw new HttpError(404, 'Solicitud no encontrada', 'not_found')
    const { rows } = await query(
      `SELECT a.id, a.application_status AS status, a.business_name AS "businessName", a.contact_phone AS "contactPhone",
              a.application_notes AS notes, a.verification_data AS details, a.rejection_reason AS "rejectionReason",
              a.created_at AS "createdAt", a.reviewed_at AS "reviewedAt", rv.name AS "reviewedBy",
              u.id AS "userId", u.name, u.email, u.role, u.account_status AS "accountStatus",
              u.email_verified_at AS "emailVerifiedAt", u.created_at AS "userCreatedAt", u.last_login_at AS "lastLoginAt"
       FROM owner_applications a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN users rv ON rv.id = a.reviewed_by
       WHERE a.id = $1`,
      [id.data],
    )
    const app = rows[0]
    if (!app) throw new HttpError(404, 'Solicitud no encontrada', 'not_found')

    const [previous, history] = await Promise.all([
      query(
        `SELECT id, application_status AS status, business_name AS "businessName", rejection_reason AS "rejectionReason",
                created_at AS "createdAt", reviewed_at AS "reviewedAt"
         FROM owner_applications WHERE user_id = $1 AND id <> $2 ORDER BY created_at DESC`,
        [app.userId, app.id],
      ),
      query(
        `SELECT l.action, l.previous_status AS "previousStatus", l.new_status AS "newStatus", l.comment,
                l.created_at AS "createdAt", u.name AS "adminName"
         FROM moderation_logs l JOIN users u ON u.id = l.admin_id
         WHERE (l.entity_type = 'owner_application' AND l.entity_id IN (SELECT id::text FROM owner_applications WHERE user_id = $1))
            OR (l.entity_type = 'user' AND l.entity_id = $1::text)
         ORDER BY l.created_at DESC LIMIT 50`,
        [app.userId],
      ),
    ])
    res.set('Cache-Control', 'no-store')
    res.json({ application: app, previous: previous.rows, history: history.rows })
  }),
)

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: multiline(1000).optional().default(''),
  comment: multiline(1000).optional().default(''),
}).strict().refine((d) => d.decision === 'approve' || d.reason.length >= 10, {
  message: 'Explica el motivo del rechazo (mínimo 10 caracteres)',
  path: ['reason'],
})

/**
 * POST /api/admin/applications/:id/decision
 * Transacción: bloquea la solicitud, exige que siga pendiente, actualiza,
 * promueve al usuario a 'owner' si se aprueba, registra auditoría y notificación.
 */
adminApplicationsRouter.post(
  '/applications/:id/decision',
  asyncHandler(async (req, res) => {
    const id = uuid.safeParse(req.params.id)
    if (!id.success) throw new HttpError(404, 'Solicitud no encontrada', 'not_found')
    const data = decisionSchema.parse(req.body)
    const admin = req.user!

    const client = await pool.connect()
    let mail: Parameters<typeof sendMail>[0] | null = null
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `SELECT a.id, a.user_id, a.application_status, a.business_name, u.name, u.email, u.role, u.account_status
         FROM owner_applications a JOIN users u ON u.id = a.user_id
         WHERE a.id = $1 FOR UPDATE OF a, u`,
        [id.data],
      )
      const app = rows[0]
      if (!app) throw new HttpError(404, 'Solicitud no encontrada', 'not_found')
      if (app.application_status !== 'pending') throw new HttpError(409, 'Esta solicitud ya fue revisada', 'already_reviewed')
      if (app.user_id === admin.id) throw new HttpError(403, 'No puedes revisar tu propia solicitud', 'self_review')

      if (data.decision === 'approve') {
        if (app.account_status !== 'active') throw new HttpError(409, 'La cuenta del solicitante está suspendida', 'account_suspended')
        await client.query(
          `UPDATE owner_applications SET application_status = 'approved', reviewed_by = $2, reviewed_at = now(), rejection_reason = NULL WHERE id = $1`,
          [app.id, admin.id],
        )
        // Solo se promueve desde 'visitor'; un admin nunca se degrada por esta vía.
        await client.query(`UPDATE users SET role = 'owner' WHERE id = $1 AND role = 'visitor'`, [app.user_id])
        await logModeration(client, {
          adminId: admin.id, entityType: 'owner_application', entityId: app.id, action: 'approve',
          previousStatus: 'pending', newStatus: 'approved', comment: data.comment || null,
          metadata: { userId: app.user_id, roleChange: app.role === 'visitor' ? 'visitor→owner' : null },
        })
        await notify(client, {
          userId: app.user_id, type: 'application.approved', title: '¡Tu cuenta de propietario fue aprobada!',
          body: 'Ya puedes registrar tus establecimientos en Barmap.', link: '/panel',
        })
        mail = {
          to: app.email,
          subject: 'Tu cuenta de propietario en Barmap fue aprobada',
          paragraphs: [`Hola, ${app.name}.`, `Aprobamos tu solicitud para ${app.business_name}. Ya puedes registrar tus establecimientos y enviarlos a revisión.`],
          action: { label: 'Ir a mi panel', url: appLink('/panel') },
        }
      } else {
        await client.query(
          `UPDATE owner_applications SET application_status = 'rejected', reviewed_by = $2, reviewed_at = now(), rejection_reason = $3 WHERE id = $1`,
          [app.id, admin.id, data.reason],
        )
        await logModeration(client, {
          adminId: admin.id, entityType: 'owner_application', entityId: app.id, action: 'reject',
          previousStatus: 'pending', newStatus: 'rejected', comment: data.reason,
          metadata: { userId: app.user_id },
        })
        await notify(client, {
          userId: app.user_id, type: 'application.rejected', title: 'Tu solicitud de propietario no fue aprobada',
          body: data.reason, link: '/registra-tu-bar',
        })
        mail = {
          to: app.email,
          subject: 'Actualización sobre tu solicitud en Barmap',
          paragraphs: [`Hola, ${app.name}.`, `Revisamos tu solicitud para ${app.business_name} y por ahora no pudimos aprobarla.`, `Motivo: ${data.reason}`, 'Puedes corregir la información y volver a enviarla.'],
          action: { label: 'Revisar mi solicitud', url: appLink('/registra-tu-bar') },
        }
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
    // El correo se envía tras confirmar la transacción.
    if (mail) await sendMail(mail)
    res.json({ ok: true })
  }),
)
