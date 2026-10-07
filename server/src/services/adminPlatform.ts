import { query } from '../db/pool.js'
import { HttpError } from '../lib/http.js'
import { appLink, sendMail } from '../lib/mailer.js'
import { Params, likeEscape } from '../lib/query.js'
import { logModeration, notify } from './audit.js'
import { slugify, withTx } from './ownerBars.js'

// ---------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------
export async function adminOverview() {
  const [counts, recent, signups] = await Promise.all([
    query(`SELECT
      (SELECT count(*)::int FROM users WHERE role = 'owner') AS owners,
      (SELECT count(*)::int FROM users WHERE role = 'visitor') AS visitors,
      (SELECT count(*)::int FROM owner_applications WHERE application_status = 'pending') AS "pendingApplications",
      (SELECT count(*)::int FROM bars WHERE deleted_at IS NULL) AS bars,
      (SELECT count(*)::int FROM bars WHERE publication_status = 'pending_review' AND deleted_at IS NULL)
        + (SELECT count(*)::int FROM bar_revisions WHERE status = 'pending_review') AS "pendingReviews",
      (SELECT count(*)::int FROM bars WHERE publication_status = 'published' AND deleted_at IS NULL) AS published,
      (SELECT count(*)::int FROM bars WHERE publication_status = 'suspended' AND deleted_at IS NULL) AS suspended,
      (SELECT count(*)::int FROM users WHERE account_status = 'suspended') AS "suspendedUsers",
      (SELECT coalesce(sum(views), 0)::int FROM bar_daily_stats WHERE day > current_date - 30) AS "views30d",
      (SELECT count(*)::int FROM reports WHERE status = 'open') AS "openReports"`),
    listLogs({ page: 1, pageSize: 8 }),
    query(`SELECT to_char(d, 'YYYY-MM-DD') AS day,
             (SELECT count(*)::int FROM users WHERE created_at::date = d) AS users,
             (SELECT count(*)::int FROM bars WHERE published_at::date = d) AS published
           FROM generate_series(current_date - 13, current_date, interval '1 day') d ORDER BY d`),
  ])
  return { ...counts.rows[0], recent: recent.items, last14: signups.rows }
}

// ---------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------
export async function listUsers(opts: { role?: string; status?: string; q?: string; sort: 'recent' | 'name' | 'bars'; page: number; pageSize: number }) {
  const p = new Params()
  const where: string[] = []
  if (opts.role) where.push(`u.role = ${p.add(opts.role)}::user_role`)
  if (opts.status) where.push(`u.account_status = ${p.add(opts.status)}::account_status`)
  if (opts.q) {
    const like = p.add(`%${likeEscape(opts.q)}%`)
    where.push(`(u.name ILIKE ${like} OR u.email::text ILIKE ${like})`)
  }
  const order = { recent: 'u.created_at DESC', name: 'lower(u.name) ASC', bars: '"barCount" DESC' }[opts.sort]
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.account_status AS "accountStatus", u.created_at AS "createdAt",
            u.email_verified_at IS NOT NULL AS "emailVerified", u.last_login_at AS "lastLoginAt",
            (SELECT application_status FROM owner_applications a WHERE a.user_id = u.id ORDER BY created_at DESC LIMIT 1) AS "applicationStatus",
            (SELECT count(*)::int FROM bars b WHERE b.owner_id = u.id AND b.deleted_at IS NULL) AS "barCount",
            count(*) OVER() AS total
     FROM users u
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${order}, u.id
     LIMIT ${p.add(opts.pageSize)} OFFSET ${p.add((opts.page - 1) * opts.pageSize)}`,
    p.values,
  )
  const counts = await query(`SELECT role, count(*)::int AS n FROM users GROUP BY role`)
  const total = rows.length ? Number(rows[0].total) : 0
  return {
    items: rows.map(({ total: _t, ...r }) => r),
    total,
    page: opts.page,
    totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
    counts: Object.fromEntries(counts.rows.map((r) => [r.role, r.n])),
  }
}

export async function userDetail(id: string) {
  const { rows } = await query(
    `SELECT id, name, email, role, account_status AS "accountStatus", suspended_reason AS "suspendedReason",
            email_verified_at AS "emailVerifiedAt", created_at AS "createdAt", last_login_at AS "lastLoginAt"
     FROM users WHERE id = $1`,
    [id],
  )
  const user = rows[0]
  if (!user) throw new HttpError(404, 'Usuario no encontrado', 'not_found')
  const [apps, bars, history] = await Promise.all([
    query(
      `SELECT id, application_status AS status, business_name AS "businessName", rejection_reason AS "rejectionReason",
              created_at AS "createdAt", reviewed_at AS "reviewedAt"
       FROM owner_applications WHERE user_id = $1 ORDER BY created_at DESC`, [id]),
    query(
      `SELECT b.id, b.name, b.slug, b.city, b.publication_status AS status, b.updated_at AS "updatedAt",
              (SELECT coalesce(thumb_url, image_url) FROM bar_images i WHERE i.bar_id = b.id AND i.revision_id IS NULL ORDER BY is_cover DESC, sort_order LIMIT 1) AS "coverUrl"
       FROM bars b WHERE b.owner_id = $1 AND b.deleted_at IS NULL ORDER BY b.updated_at DESC`, [id]),
    query(
      `SELECT l.action, l.entity_type AS "entityType", l.comment, l.created_at AS "createdAt", a.name AS "adminName"
       FROM moderation_logs l JOIN users a ON a.id = l.admin_id
       WHERE (l.entity_type = 'user' AND l.entity_id = $2)
          OR (l.entity_type = 'owner_application' AND l.entity_id IN (SELECT id::text FROM owner_applications WHERE user_id = $1::uuid))
          OR (l.entity_type = 'bar' AND l.entity_id IN (SELECT id::text FROM bars WHERE owner_id = $1::uuid))
       ORDER BY l.created_at DESC LIMIT 30`, [id, id]),
  ])
  return { user, applications: apps.rows, bars: bars.rows, history: history.rows }
}

/**
 * Suspender: la cuenta pierde las funciones de gestión, sus bares dejan de
 * ser públicos (la vista public_bars exige propietario activo) y todas sus
 * sesiones se invalidan (token_version + 1). Nunca se aplica a admins.
 */
export async function setUserStatus(adminId: string, userId: string, action: 'suspend' | 'reactivate', reason: string) {
  let mail: Parameters<typeof sendMail>[0] | null = null
  await withTx(async (c) => {
    const { rows } = await c.query(`SELECT id, name, email, role, account_status FROM users WHERE id = $1 FOR UPDATE`, [userId])
    const u = rows[0]
    if (!u) throw new HttpError(404, 'Usuario no encontrado', 'not_found')
    if (u.id === adminId) throw new HttpError(403, 'No puedes cambiar el estado de tu propia cuenta', 'self_action')
    if (u.role === 'admin') throw new HttpError(403, 'Las cuentas de administración no se suspenden desde el panel', 'forbidden')
    const to = action === 'suspend' ? 'suspended' : 'active'
    if (u.account_status === to) throw new HttpError(409, action === 'suspend' ? 'La cuenta ya está suspendida' : 'La cuenta ya está activa', 'invalid_state')
    await c.query(
      `UPDATE users SET account_status = $2, suspended_reason = $3, token_version = token_version + 1 WHERE id = $1`,
      [u.id, to, action === 'suspend' ? reason : null],
    )
    await logModeration(c, {
      adminId, entityType: 'user', entityId: u.id, action, previousStatus: u.account_status, newStatus: to, comment: reason || null,
      metadata: { email: u.email, role: u.role },
    })
    await notify(c, {
      userId: u.id, type: `account.${action}`,
      title: action === 'suspend' ? 'Tu cuenta fue suspendida' : 'Tu cuenta fue reactivada', body: reason || undefined,
    })
    mail = {
      to: u.email,
      subject: action === 'suspend' ? 'Tu cuenta de Barmap fue suspendida' : 'Tu cuenta de Barmap fue reactivada',
      paragraphs:
        action === 'suspend'
          ? [`Hola, ${u.name}.`, 'Suspendimos tu cuenta. Mientras la suspensión esté activa no podrás gestionar establecimientos y tus publicaciones no serán visibles.', `Motivo: ${reason}`, 'Responde a este correo si crees que se trata de un error.']
          : [`Hola, ${u.name}.`, 'Reactivamos tu cuenta. Ya puedes iniciar sesión y gestionar tus establecimientos.'],
      action: action === 'reactivate' ? { label: 'Iniciar sesión', url: appLink('/entrar') } : undefined,
    }
  })
  if (mail) await sendMail(mail)
}

// ---------------------------------------------------------------------
// Catálogos (categorías, tipos, servicios)
// ---------------------------------------------------------------------
export const CATALOGS = {
  categories: { table: 'categories', entity: 'category', usage: `(SELECT count(*)::int FROM bars WHERE category_id = t.id AND deleted_at IS NULL)`, hasIcon: true },
  types: { table: 'establishment_types', entity: 'establishment_type', usage: `(SELECT count(*)::int FROM bars WHERE type_id = t.id AND deleted_at IS NULL)`, hasIcon: false },
  amenities: { table: 'amenities', entity: 'amenity', usage: `(SELECT count(*)::int FROM bar_amenities WHERE amenity_id = t.id)`, hasIcon: true },
} as const
export type CatalogKind = keyof typeof CATALOGS

export async function listCatalog(kind: CatalogKind) {
  const cfg = CATALOGS[kind]
  const { rows } = await query(
    `SELECT t.id, t.name, t.slug, ${cfg.hasIcon ? 't.icon' : 'NULL AS icon'}, t.sort_order AS "sortOrder", t.is_active AS "isActive", ${cfg.usage} AS usage
     FROM ${cfg.table} t ORDER BY t.sort_order, t.name`,
  )
  return rows
}

async function uniqueCatalogSlug(table: string, name: string, excludeId?: number) {
  const base = slugify(name)
  for (let i = 0; i < 20; i++) {
    const slug = i ? `${base}-${i + 1}` : base
    const { rowCount } = await query(`SELECT 1 FROM ${table} WHERE slug = $1 AND id <> coalesce($2::int, -1)`, [slug, excludeId ?? null])
    if (!rowCount) return slug
  }
  throw new HttpError(409, 'No se pudo generar un identificador único', 'slug_conflict')
}

export async function createCatalogItem(adminId: string, kind: CatalogKind, input: { name: string; icon?: string | null }) {
  const cfg = CATALOGS[kind]
  const exists = await query(`SELECT 1 FROM ${cfg.table} WHERE lower(name) = lower($1)`, [input.name])
  if (exists.rowCount) throw new HttpError(409, 'Ya existe un elemento con ese nombre', 'duplicate', { name: ['Ya existe'] })
  const slug = await uniqueCatalogSlug(cfg.table, input.name)
  return withTx(async (c) => {
    const { rows } = await c.query(
      cfg.hasIcon
        ? `INSERT INTO ${cfg.table} (name, slug, icon, sort_order) VALUES ($1, $2, $3, (SELECT coalesce(max(sort_order), 0) + 1 FROM ${cfg.table})) RETURNING id`
        : `INSERT INTO ${cfg.table} (name, slug, sort_order) VALUES ($1, $2, (SELECT coalesce(max(sort_order), 0) + 1 FROM ${cfg.table})) RETURNING id`,
      cfg.hasIcon ? [input.name, slug, input.icon ?? null] : [input.name, slug],
    )
    await logModeration(c, { adminId, entityType: cfg.entity, entityId: String(rows[0].id), action: 'create', newStatus: 'active', metadata: { name: input.name } })
    return rows[0].id as number
  })
}

export async function updateCatalogItem(adminId: string, kind: CatalogKind, id: number, input: { name?: string; icon?: string | null; isActive?: boolean; sortOrder?: number }) {
  const cfg = CATALOGS[kind]
  await withTx(async (c) => {
    const { rows } = await c.query(`SELECT * FROM ${cfg.table} WHERE id = $1 FOR UPDATE`, [id])
    const item = rows[0]
    if (!item) throw new HttpError(404, 'Elemento no encontrado', 'not_found')
    if (input.name && input.name.toLowerCase() !== item.name.toLowerCase()) {
      const dup = await c.query(`SELECT 1 FROM ${cfg.table} WHERE lower(name) = lower($1) AND id <> $2`, [input.name, id])
      if (dup.rowCount) throw new HttpError(409, 'Ya existe un elemento con ese nombre', 'duplicate', { name: ['Ya existe'] })
    }
    // El slug no cambia al renombrar: se usa en URLs y filtros guardados.
    await c.query(
      `UPDATE ${cfg.table} SET name = coalesce($2, name), is_active = coalesce($3, is_active), sort_order = coalesce($4, sort_order)
       ${cfg.hasIcon ? ', icon = CASE WHEN $5::boolean THEN $6 ELSE icon END' : ''} WHERE id = $1`,
      cfg.hasIcon
        ? [id, input.name ?? null, input.isActive ?? null, input.sortOrder ?? null, input.icon !== undefined, input.icon ?? null]
        : [id, input.name ?? null, input.isActive ?? null, input.sortOrder ?? null],
    )
    const action = input.isActive === false && item.is_active ? 'deactivate' : input.isActive === true && !item.is_active ? 'activate' : 'edit'
    await logModeration(c, {
      adminId, entityType: cfg.entity, entityId: String(id), action,
      previousStatus: item.is_active ? 'active' : 'inactive', newStatus: (input.isActive ?? item.is_active) ? 'active' : 'inactive',
      metadata: { name: input.name ?? item.name, before: { name: item.name, icon: item.icon, sortOrder: item.sort_order }, after: input },
    })
  })
}

export async function deleteCatalogItem(adminId: string, kind: CatalogKind, id: number) {
  const cfg = CATALOGS[kind]
  await withTx(async (c) => {
    const { rows } = await c.query(`SELECT t.name, ${cfg.usage} AS usage FROM ${cfg.table} t WHERE t.id = $1 FOR UPDATE`, [id])
    if (!rows[0]) throw new HttpError(404, 'Elemento no encontrado', 'not_found')
    if (rows[0].usage > 0) throw new HttpError(409, `Está en uso por ${rows[0].usage} establecimiento(s). Desactívalo en lugar de eliminarlo.`, 'in_use')
    await c.query(`DELETE FROM ${cfg.table} WHERE id = $1`, [id])
    await logModeration(c, { adminId, entityType: cfg.entity, entityId: String(id), action: 'delete', previousStatus: 'active', metadata: { name: rows[0].name } })
  })
}

// ---------------------------------------------------------------------
// Historial de moderación
// ---------------------------------------------------------------------
export async function listLogs(opts: { entityType?: string; action?: string; adminId?: string; q?: string; from?: string; to?: string; page: number; pageSize: number }) {
  const p = new Params()
  const where: string[] = []
  if (opts.entityType) where.push(`l.entity_type = ${p.add(opts.entityType)}::moderation_entity`)
  if (opts.action) where.push(`l.action = ${p.add(opts.action)}`)
  if (opts.adminId) where.push(`l.admin_id = ${p.add(opts.adminId)}`)
  if (opts.from) where.push(`l.created_at >= ${p.add(opts.from)}::date`)
  if (opts.to) where.push(`l.created_at < ${p.add(opts.to)}::date + 1`)
  const label = `CASE l.entity_type
      WHEN 'bar' THEN (SELECT name FROM bars WHERE id::text = l.entity_id)
      WHEN 'bar_revision' THEN (SELECT b.name FROM bar_revisions r JOIN bars b ON b.id = r.bar_id WHERE r.id::text = l.entity_id)
      WHEN 'user' THEN (SELECT name FROM users WHERE id::text = l.entity_id)
      WHEN 'owner_application' THEN (SELECT u.name || ' · ' || a.business_name FROM owner_applications a JOIN users u ON u.id = a.user_id WHERE a.id::text = l.entity_id)
      ELSE l.metadata->>'name' END`
  if (opts.q) {
    const like = p.add(`%${likeEscape(opts.q)}%`)
    where.push(`(coalesce(${label}, l.metadata->>'name', '') ILIKE ${like} OR coalesce(l.comment, '') ILIKE ${like} OR a.name ILIKE ${like})`)
  }
  const { rows } = await query(
    `SELECT l.id, l.entity_type AS "entityType", l.entity_id AS "entityId", l.action, l.previous_status AS "previousStatus",
            l.new_status AS "newStatus", l.comment, l.created_at AS "createdAt", l.metadata,
            a.id AS "adminId", a.name AS "adminName",
            coalesce(${label}, l.metadata->>'name') AS "entityLabel",
            CASE WHEN l.entity_type = 'bar_revision' THEN (SELECT bar_id::text FROM bar_revisions WHERE id::text = l.entity_id) END AS "barId",
            count(*) OVER() AS total
     FROM moderation_logs l JOIN users a ON a.id = l.admin_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT ${p.add(opts.pageSize)} OFFSET ${p.add((opts.page - 1) * opts.pageSize)}`,
    p.values,
  )
  const total = rows.length ? Number(rows[0].total) : 0
  return { items: rows.map(({ total: _t, ...r }) => r), total, page: opts.page, totalPages: Math.max(1, Math.ceil(total / opts.pageSize)) }
}
