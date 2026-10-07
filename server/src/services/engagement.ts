import crypto from 'node:crypto'
import { config } from '../config.js'
import { query } from '../db/pool.js'
import { HttpError } from '../lib/http.js'
import { Params } from '../lib/query.js'
import { logModeration, notify } from './audit.js'
import { withTx } from './ownerBars.js'
import { searchBars, serializeSummary } from './publicBars.js'

/** Identificador anónimo del visitante: hash con sal secreta; nunca se guarda la IP. */
export function visitorHash(ip: string | undefined, userAgent: string | undefined) {
  return crypto.createHmac('sha256', config.jwtSecret).update(`${ip ?? ''}|${userAgent ?? ''}`).digest('hex').slice(0, 32)
}

async function publicBarId(slug: string) {
  const { rows } = await query(`SELECT id FROM public_bars WHERE slug = $1`, [slug])
  if (!rows[0]) throw new HttpError(404, 'Este bar no existe o ya no está disponible', 'not_found')
  return rows[0].id as string
}

// ---------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------
export async function favoriteIds(userId: string) {
  const { rows } = await query(`SELECT bar_id FROM favorites WHERE user_id = $1`, [userId])
  return rows.map((r) => r.bar_id as string)
}

/** Favoritos con datos de tarjeta. Solo bares públicos: si uno deja de estarlo, desaparece de la lista. */
export async function favoriteBars(userId: string, coords?: { lat: number; lng: number }) {
  const ids = await favoriteIds(userId)
  if (!ids.length) return []
  const res = await searchBars({ sort: 'recommended', page: 1, pageSize: 100, lat: coords?.lat, lng: coords?.lng, ids })
  const { rows } = await query(`SELECT bar_id, created_at FROM favorites WHERE user_id = $1`, [userId])
  const at = new Map(rows.map((r) => [r.bar_id as string, new Date(r.created_at).getTime()]))
  return res.items.sort((a, b) => (at.get(b.id) ?? 0) - (at.get(a.id) ?? 0))
}

export async function setFavorite(userId: string, barId: string, on: boolean) {
  if (on) {
    // Solo se pueden guardar bares públicos.
    const { rowCount } = await query(`SELECT 1 FROM public_bars WHERE id = $1`, [barId])
    if (!rowCount) throw new HttpError(404, 'Este bar no está disponible', 'not_found')
    const ins = await query(`INSERT INTO favorites (user_id, bar_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, barId])
    if (ins.rowCount) {
      await query(
        `INSERT INTO bar_daily_stats (bar_id, day, favorites_added) VALUES ($1, current_date, 1)
         ON CONFLICT (bar_id, day) DO UPDATE SET favorites_added = bar_daily_stats.favorites_added + 1`,
        [barId],
      )
    }
  } else {
    await query(`DELETE FROM favorites WHERE user_id = $1 AND bar_id = $2`, [userId, barId])
  }
}

// ---------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------
export async function listNotifications(userId: string, limit = 30) {
  const { rows } = await query(
    `SELECT id, type, title, body, link, read_at AS "readAt", created_at AS "createdAt"
     FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  )
  const unread = await query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [userId])
  return { items: rows, unread: unread.rows[0].n as number }
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  if (ids?.length) await query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND id = ANY($2::uuid[]) AND read_at IS NULL`, [userId, ids])
  else await query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [userId])
}

// ---------------------------------------------------------------------
// Analítica (visitas, clics en "Cómo llegar", compartidos)
// ---------------------------------------------------------------------
const EVENT_COLUMN = { view: 'views', directions: 'direction_clicks', share: 'shares' } as const
export type EventType = keyof typeof EVENT_COLUMN
let lastPurge = 0

export async function recordEvent(slug: string, type: EventType, visitor: string) {
  const barId = await publicBarId(slug)
  const day = new Date().toISOString().slice(0, 10)
  const key = crypto.createHash('sha256').update(`${visitor}|${barId}|${type}|${day}`).digest('hex')
  // Una vez por visitante, bar, tipo y día.
  const first = await query(`INSERT INTO event_dedupe (key) VALUES ($1) ON CONFLICT DO NOTHING`, [key])
  if (first.rowCount) {
    const col = EVENT_COLUMN[type]
    await query(
      `INSERT INTO bar_daily_stats (bar_id, day, ${col}) VALUES ($1, current_date, 1)
       ON CONFLICT (bar_id, day) DO UPDATE SET ${col} = bar_daily_stats.${col} + 1`,
      [barId],
    )
  }
  if (Date.now() - lastPurge > 3600_000) {
    lastPurge = Date.now()
    await query(`DELETE FROM event_dedupe WHERE created_at < now() - interval '3 days'`)
  }
}

export async function ownerStats(ownerId: string, days: number) {
  const [series, perBar] = await Promise.all([
    query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day,
              coalesce(sum(s.views), 0)::int AS views, coalesce(sum(s.direction_clicks), 0)::int AS directions,
              coalesce(sum(s.shares), 0)::int AS shares, coalesce(sum(s.favorites_added), 0)::int AS favorites
       FROM generate_series(current_date - ($2::int - 1), current_date, interval '1 day') d
       LEFT JOIN bar_daily_stats s ON s.day = d::date AND s.bar_id IN (SELECT id FROM bars WHERE owner_id = $1 AND deleted_at IS NULL)
       GROUP BY d ORDER BY d`,
      [ownerId, days],
    ),
    query(
      `SELECT b.id, b.name, b.slug, b.publication_status AS status,
              coalesce(sum(s.views), 0)::int AS views, coalesce(sum(s.direction_clicks), 0)::int AS directions,
              coalesce(sum(s.shares), 0)::int AS shares, coalesce(sum(s.favorites_added), 0)::int AS favorites,
              (SELECT count(*)::int FROM favorites f WHERE f.bar_id = b.id) AS "savedBy"
       FROM bars b LEFT JOIN bar_daily_stats s ON s.bar_id = b.id AND s.day > current_date - $2::int
       WHERE b.owner_id = $1 AND b.deleted_at IS NULL
       GROUP BY b.id ORDER BY views DESC, b.name`,
      [ownerId, days],
    ),
  ])
  return { days, series: series.rows, bars: perBar.rows }
}

// ---------------------------------------------------------------------
// Reportes de usuarios
// ---------------------------------------------------------------------
export type ReportReason = 'wrong_info' | 'closed_permanently' | 'inappropriate' | 'duplicate' | 'other'

export async function createReport(slug: string, input: { reason: ReportReason; details: string }, reporter: { userId?: string; hash: string }) {
  const barId = await publicBarId(slug)
  // Un reporte abierto por persona y bar cada 24 h.
  const recent = await query(
    `SELECT 1 FROM reports WHERE bar_id = $1 AND status = 'open' AND created_at > now() - interval '24 hours'
       AND (reporter_hash = $2 OR ($3::uuid IS NOT NULL AND reporter_id = $3::uuid))`,
    [barId, reporter.hash, reporter.userId ?? null],
  )
  if (recent.rowCount) throw new HttpError(409, 'Ya recibimos tu reporte sobre este bar. Gracias.', 'already_reported')
  await query(`INSERT INTO reports (bar_id, reporter_id, reporter_hash, reason, details) VALUES ($1, $2, $3, $4, $5)`, [
    barId, reporter.userId ?? null, reporter.hash, input.reason, input.details || null,
  ])
}

export async function listReports(opts: { status?: 'open' | 'resolved' | 'dismissed'; page: number; pageSize: number }) {
  const p = new Params()
  const where = opts.status ? `WHERE r.status = ${p.add(opts.status)}::report_status` : ''
  const { rows } = await query(
    `SELECT r.id, r.reason, r.details, r.status, r.created_at AS "createdAt", r.resolved_at AS "resolvedAt", r.resolution_note AS "resolutionNote",
            b.id AS "barId", b.name AS "barName", b.slug AS "barSlug", b.city, b.publication_status AS "barStatus",
            ru.name AS "reporterName", rv.name AS "resolvedBy",
            (SELECT count(*)::int FROM reports o WHERE o.bar_id = r.bar_id AND o.status = 'open') AS "openForBar",
            count(*) OVER() AS total
     FROM reports r JOIN bars b ON b.id = r.bar_id
     LEFT JOIN users ru ON ru.id = r.reporter_id LEFT JOIN users rv ON rv.id = r.resolved_by
     ${where}
     ORDER BY (r.status = 'open') DESC, r.created_at DESC
     LIMIT ${p.add(opts.pageSize)} OFFSET ${p.add((opts.page - 1) * opts.pageSize)}`,
    p.values,
  )
  const counts = await query(`SELECT status, count(*)::int AS n FROM reports GROUP BY status`)
  const total = rows.length ? Number(rows[0].total) : 0
  return {
    items: rows.map(({ total: _t, ...r }) => r),
    total,
    page: opts.page,
    totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
    counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
  }
}

export async function resolveReport(adminId: string, id: string, action: 'resolve' | 'dismiss', note: string) {
  await withTx(async (c) => {
    const { rows } = await c.query(`SELECT r.id, r.status, r.bar_id, b.name FROM reports r JOIN bars b ON b.id = r.bar_id WHERE r.id = $1 FOR UPDATE OF r`, [id])
    const r = rows[0]
    if (!r) throw new HttpError(404, 'Reporte no encontrado', 'not_found')
    if (r.status !== 'open') throw new HttpError(409, 'Este reporte ya fue atendido', 'already_resolved')
    const to = action === 'resolve' ? 'resolved' : 'dismissed'
    await c.query(`UPDATE reports SET status = $2, resolved_by = $3, resolved_at = now(), resolution_note = $4 WHERE id = $1`, [id, to, adminId, note || null])
    await logModeration(c, {
      adminId, entityType: 'report', entityId: id, action, previousStatus: 'open', newStatus: to, comment: note || null,
      metadata: { name: r.name, barId: r.bar_id },
    })
  })
}

// ---------------------------------------------------------------------
// Verificación de establecimientos (insignia "Verificado")
// ---------------------------------------------------------------------
export async function setBarVerified(adminId: string, barId: string, verified: boolean, note: string) {
  await withTx(async (c) => {
    const { rows } = await c.query(`SELECT id, name, owner_id, verified_at FROM bars WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [barId])
    const b = rows[0]
    if (!b) throw new HttpError(404, 'Establecimiento no encontrado', 'not_found')
    if (!!b.verified_at === verified) throw new HttpError(409, verified ? 'Ya está verificado' : 'No está verificado', 'invalid_state')
    await c.query(`UPDATE bars SET verified_at = ${verified ? 'now()' : 'NULL'} WHERE id = $1`, [barId])
    await logModeration(c, {
      adminId, entityType: 'bar', entityId: barId, action: verified ? 'verify' : 'unverify',
      previousStatus: verified ? 'unverified' : 'verified', newStatus: verified ? 'verified' : 'unverified', comment: note || null, metadata: { name: b.name },
    })
    if (verified) {
      await notify(c, { userId: b.owner_id, type: 'bar.verified', title: `«${b.name}» ahora tiene la insignia de verificado`, link: '/panel/establecimientos' })
    }
  })
}

export { serializeSummary }
