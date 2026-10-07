import type { PoolClient } from 'pg'
import { query } from '../db/pool.js'
import { HttpError } from '../lib/http.js'
import { removeStored } from '../lib/images.js'
import { appLink, sendMail } from '../lib/mailer.js'
import { Params, likeEscape } from '../lib/query.js'
import { logModeration, notify } from './audit.js'
import {
  checkCatalog, diffFields, loadLive, resolveImages, validateForSubmit, withTx, writeLive,
  type BarFields, type BarRow, type RevisionRow,
} from './ownerBars.js'

/**
 * Moderación de establecimientos (solo admins; el router aplica requireRole('admin')).
 * Cada decisión: transacción + bloqueo de filas + estado previo verificado +
 * registro en moderation_logs + notificación. El correo se envía tras el COMMIT.
 */

type Mail = Parameters<typeof sendMail>[0]
const NOT_FOUND = () => new HttpError(404, 'Establecimiento no encontrado', 'not_found')

// ---------------------------------------------------------------------
// Cola de revisión
// ---------------------------------------------------------------------
export async function moderationQueue(opts: { kind?: 'new' | 'revision'; q?: string; page: number; pageSize: number }) {
  const p = new Params()
  const where: string[] = []
  if (opts.kind) where.push(`kind = ${p.add(opts.kind)}`)
  if (opts.q) {
    const like = p.add(`%${likeEscape(opts.q)}%`)
    where.push(`(name ILIKE ${like} OR owner_name ILIKE ${like} OR owner_email ILIKE ${like} OR city ILIKE ${like})`)
  }
  const { rows } = await query(
    `WITH queue AS (
       SELECT 'new' AS kind, b.id AS bar_id, NULL::uuid AS revision_id, b.name, b.city, b.neighborhood, b.submitted_at,
              NULL::text[] AS changed_fields, b.owner_id
       FROM bars b WHERE b.publication_status = 'pending_review' AND b.deleted_at IS NULL
       UNION ALL
       SELECT 'revision', b.id, r.id, coalesce(r.snapshot->>'name', b.name), b.city, b.neighborhood, r.submitted_at,
              r.changed_fields, b.owner_id
       FROM bar_revisions r JOIN bars b ON b.id = r.bar_id
       WHERE r.status = 'pending_review' AND b.deleted_at IS NULL
     )
     SELECT * , count(*) OVER() AS total FROM (
       SELECT q.kind, q.bar_id AS "barId", q.revision_id AS "revisionId", q.name, q.city, q.neighborhood,
              q.submitted_at AS "submittedAt", q.changed_fields AS "changedFields",
              u.name AS owner_name, u.email AS owner_email, u.account_status AS "ownerStatus",
              (SELECT coalesce(thumb_url, image_url) FROM bar_images i WHERE i.bar_id = q.bar_id AND i.revision_id IS NULL
               ORDER BY is_cover DESC, sort_order LIMIT 1) AS "coverUrl",
              (SELECT count(*)::int FROM bars d WHERE d.id <> q.bar_id AND d.deleted_at IS NULL
                 AND lower(d.name) = lower(q.name) AND lower(coalesce(d.city, '')) = lower(coalesce(q.city, ''))) AS "duplicateCount"
       FROM queue q JOIN users u ON u.id = q.owner_id
     ) x
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY "submittedAt" ASC NULLS LAST
     LIMIT ${p.add(opts.pageSize)} OFFSET ${p.add((opts.page - 1) * opts.pageSize)}`,
    p.values,
  )
  const counts = await query(
    `SELECT (SELECT count(*)::int FROM bars WHERE publication_status = 'pending_review' AND deleted_at IS NULL) AS new,
            (SELECT count(*)::int FROM bar_revisions WHERE status = 'pending_review') AS revision`,
  )
  const total = rows.length ? Number(rows[0].total) : 0
  return {
    items: rows.map(({ total: _t, owner_name, owner_email, ...r }) => ({ ...r, ownerName: owner_name, ownerEmail: owner_email })),
    total,
    page: opts.page,
    totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
    counts: counts.rows[0] as { new: number; revision: number },
  }
}

// ---------------------------------------------------------------------
// Detalle para revisar
// ---------------------------------------------------------------------
async function openRevisionFor(c: PoolClient | null, barId: string) {
  const sql = `SELECT id, status, snapshot, review_comment, submitted_at, updated_at, base_version, changed_fields
               FROM bar_revisions WHERE bar_id = $1 AND status IN ('draft', 'pending_review', 'changes_requested')`
  const { rows } = c ? await c.query<RevisionRow & { changed_fields: string[] }>(sql, [barId]) : await query<RevisionRow & { changed_fields: string[] }>(sql, [barId])
  return rows[0] ?? null
}

export async function reviewDetail(barId: string) {
  const { rows } = await query<BarRow>(`SELECT * FROM bars WHERE id = $1 AND deleted_at IS NULL`, [barId])
  const bar = rows[0]
  if (!bar) throw NOT_FOUND()
  const [live, rev, owner, dupes, history] = await Promise.all([
    loadLive(null, bar),
    openRevisionFor(null, bar.id),
    query(
      `SELECT u.id, u.name, u.email, u.account_status AS "accountStatus", u.role, u.created_at AS "createdAt",
              a.business_name AS "businessName", a.contact_phone AS "contactPhone",
              (SELECT count(*)::int FROM bars WHERE owner_id = u.id AND deleted_at IS NULL) AS "barCount",
              (SELECT count(*)::int FROM bars WHERE owner_id = u.id AND publication_status = 'published') AS "publishedCount"
       FROM users u
       LEFT JOIN LATERAL (SELECT business_name, contact_phone FROM owner_applications WHERE user_id = u.id
                          AND application_status = 'approved' ORDER BY reviewed_at DESC LIMIT 1) a ON true
       WHERE u.id = $1`,
      [bar.owner_id],
    ),
    query(
      `SELECT d.id, d.name, d.city, d.slug, d.publication_status AS status, u.name AS "ownerName", d.owner_id = $3 AS "sameOwner"
       FROM bars d JOIN users u ON u.id = d.owner_id
       WHERE d.id <> $1 AND d.deleted_at IS NULL AND lower(d.name) = lower($2) AND lower(coalesce(d.city, '')) = lower(coalesce($4, ''))
       LIMIT 5`,
      [bar.id, bar.name, bar.owner_id, bar.city],
    ),
    query(
      `SELECT l.action, l.entity_type AS "entityType", l.previous_status AS "previousStatus", l.new_status AS "newStatus",
              l.comment, l.created_at AS "createdAt", u.name AS "adminName"
       FROM moderation_logs l JOIN users u ON u.id = l.admin_id
       WHERE (l.entity_type = 'bar' AND l.entity_id = $1)
          OR (l.entity_type = 'bar_revision' AND l.entity_id IN (SELECT id::text FROM bar_revisions WHERE bar_id = $2))
       ORDER BY l.created_at DESC LIMIT 50`,
      [bar.id, bar.id],
    ),
  ])

  let revision = null
  if (rev) {
    const { imageIds, ...fields } = rev.snapshot
    const images = await resolveImages(null, bar.id, imageIds)
    const liveIds = new Set(live.images.map((i) => i.id))
    revision = {
      id: rev.id,
      status: rev.status,
      submittedAt: rev.submitted_at,
      reviewComment: rev.review_comment,
      changedFields: diffFields({ ...live.data, imageIds: live.images.map((i) => i.id) }, rev.snapshot),
      outdated: rev.base_version !== bar.version,
      data: fields,
      images,
      addedImageIds: images.filter((i) => !liveIds.has(i.id)).map((i) => i.id),
      removedImageIds: live.images.filter((i) => !imageIds.includes(i.id)).map((i) => i.id),
    }
  }

  return {
    bar: {
      id: bar.id,
      slug: bar.slug,
      status: bar.publication_status,
      moderationNote: bar.moderation_note,
      submittedAt: bar.submitted_at,
      publishedAt: bar.published_at,
      updatedAt: bar.updated_at,
      createdAt: bar.created_at,
      version: bar.version,
      verifiedAt: (bar as unknown as { verified_at: string | null }).verified_at,
      openReports: Number((await query(`SELECT count(*) FROM reports WHERE bar_id = $1 AND status = 'open'`, [bar.id])).rows[0].count),
    },
    data: live.data,
    images: live.images,
    missing: validateForSubmit(live.data, live.images),
    revision,
    owner: owner.rows[0],
    duplicates: dupes.rows,
    history: history.rows,
  }
}

// ---------------------------------------------------------------------
// Decisiones
// ---------------------------------------------------------------------
export type Decision = 'approve' | 'reject' | 'request_changes'

async function lockBarAndOwner(c: PoolClient, barId: string) {
  const { rows } = await c.query<BarRow & { owner_email: string; owner_name: string; owner_status: string; owner_role: string }>(
    `SELECT b.*, u.email AS owner_email, u.name AS owner_name, u.account_status AS owner_status, u.role AS owner_role
     FROM bars b JOIN users u ON u.id = b.owner_id
     WHERE b.id = $1 AND b.deleted_at IS NULL FOR UPDATE OF b`,
    [barId],
  )
  if (!rows[0]) throw NOT_FOUND()
  return rows[0]
}

const DECISION_TEXT: Record<Decision, { title: (n: string) => string; status: string }> = {
  approve: { title: (n) => `«${n}» fue aprobado`, status: 'published' },
  reject: { title: (n) => `«${n}» no fue aprobado`, status: 'rejected' },
  request_changes: { title: (n) => `Pedimos cambios en «${n}»`, status: 'changes_requested' },
}

/** Decide sobre un bar nuevo (pending_review). */
export async function decideNewBar(adminId: string, barId: string, decision: Decision, comment: string) {
  let mail: Mail | null = null
  await withTx(async (c) => {
    const bar = await lockBarAndOwner(c, barId)
    if (bar.publication_status !== 'pending_review') throw new HttpError(409, 'Este establecimiento ya no está pendiente de revisión', 'not_pending')
    if (bar.owner_id === adminId) throw new HttpError(403, 'No puedes moderar tus propios establecimientos', 'self_review')

    if (decision === 'approve') {
      if (bar.owner_role !== 'owner' || bar.owner_status !== 'active') {
        throw new HttpError(409, 'La cuenta del propietario no está activa: no se puede publicar', 'owner_inactive')
      }
      const { data, images } = await loadLive(c, bar)
      const missing = validateForSubmit(data, images)
      if (Object.keys(missing).length) throw new HttpError(422, `Falta información: ${Object.values(missing).join('; ')}`, 'incomplete')
      await c.query(`UPDATE bar_images SET is_cover = (id = $2) WHERE bar_id = $1 AND revision_id IS NULL`, [bar.id, images[0].id])
      await c.query(
        `UPDATE bars SET publication_status = 'published', published_at = coalesce(published_at, now()), moderation_note = NULL WHERE id = $1`,
        [bar.id],
      )
    } else {
      await c.query(`UPDATE bars SET publication_status = $2, moderation_note = $3 WHERE id = $1`, [bar.id, DECISION_TEXT[decision].status, comment])
    }

    await logModeration(c, {
      adminId, entityType: 'bar', entityId: bar.id, action: decision,
      previousStatus: 'pending_review', newStatus: DECISION_TEXT[decision].status, comment: comment || null,
      metadata: { ownerId: bar.owner_id, name: bar.name },
    })
    const name = bar.name as string
    await notify(c, {
      userId: bar.owner_id as string, type: `bar.${decision}`, title: DECISION_TEXT[decision].title(name),
      body: decision === 'approve' ? 'Ya es visible en Barmap.' : comment, link: decision === 'approve' ? '/panel/establecimientos' : `/panel/establecimientos/${bar.id}`,
    })
    mail = decisionMail(bar.owner_email, bar.owner_name, name, decision, comment, decision === 'approve' ? `/bares/${bar.slug}` : `/panel/establecimientos/${bar.id}`)
  })
  if (mail) await sendMail(mail)
}

/** Decide sobre una revisión de un bar publicado. Aprobar aplica la propuesta a la versión pública. */
export async function decideRevision(adminId: string, barId: string, decision: Decision, comment: string) {
  let mail: Mail | null = null
  const filesToRemove: string[] = []
  await withTx(async (c) => {
    const bar = await lockBarAndOwner(c, barId)
    const rev = await openRevisionFor(c, bar.id)
    if (!rev || rev.status !== 'pending_review') throw new HttpError(409, 'No hay cambios pendientes de revisión para este establecimiento', 'not_pending')
    await c.query(`SELECT 1 FROM bar_revisions WHERE id = $1 FOR UPDATE`, [rev.id])
    if (bar.owner_id === adminId) throw new HttpError(403, 'No puedes moderar tus propios establecimientos', 'self_review')

    let newStatus: string
    if (decision === 'approve') {
      if (rev.base_version !== bar.version) {
        throw new HttpError(409, 'La versión publicada cambió después de que se enviaron estos cambios. Pide al propietario que los revise de nuevo.', 'outdated')
      }
      if (bar.owner_status !== 'active') throw new HttpError(409, 'La cuenta del propietario no está activa', 'owner_inactive')
      const { imageIds, ...fields } = rev.snapshot
      const data = await checkCatalog(c, fields as BarFields)
      const images = await resolveImages(c, bar.id, imageIds)
      const missing = validateForSubmit(data, images)
      if (Object.keys(missing).length) throw new HttpError(422, `Falta información: ${Object.values(missing).join('; ')}`, 'incomplete')

      await writeLive(c, bar, data)
      // Fotos: las de la propuesta pasan a ser públicas en su orden; las que salieron se borran.
      const { rows: all } = await c.query(`SELECT id, storage_key, revision_id FROM bar_images WHERE bar_id = $1 AND (revision_id IS NULL OR revision_id = $2)`, [bar.id, rev.id])
      const keep = new Set(imageIds)
      for (const img of all) {
        if (!keep.has(img.id)) {
          filesToRemove.push(img.storage_key)
          await c.query(`DELETE FROM bar_images WHERE id = $1`, [img.id])
        }
      }
      await c.query(`UPDATE bar_images SET is_cover = false WHERE bar_id = $1`, [bar.id])
      for (const [i, id] of imageIds.entries()) {
        await c.query(`UPDATE bar_images SET revision_id = NULL, sort_order = $2, is_cover = $3 WHERE id = $1`, [id, i, i === 0])
      }
      await c.query(`UPDATE bars SET version = version + 1 WHERE id = $1`, [bar.id])
      newStatus = 'approved'
    } else if (decision === 'request_changes') {
      newStatus = 'changes_requested'
    } else {
      // Rechazada: la propuesta se cierra y sus fotos (nunca públicas) se eliminan.
      const { rows } = await c.query(`DELETE FROM bar_images WHERE revision_id = $1 RETURNING storage_key`, [rev.id])
      filesToRemove.push(...rows.map((r) => r.storage_key as string))
      newStatus = 'rejected'
    }

    await c.query(`UPDATE bar_revisions SET status = $2, reviewed_by = $3, reviewed_at = now(), review_comment = $4 WHERE id = $1`, [
      rev.id, newStatus, adminId, comment || null,
    ])
    await logModeration(c, {
      adminId, entityType: 'bar_revision', entityId: rev.id, action: decision, previousStatus: 'pending_review', newStatus,
      comment: comment || null, metadata: { barId: bar.id, name: bar.name, changedFields: rev.changed_fields },
    })
    const name = bar.name as string
    const title = decision === 'approve' ? `Tus cambios en «${name}» ya están publicados` : decision === 'reject' ? `Tus cambios en «${name}» no fueron aprobados` : `Pedimos ajustes a tus cambios en «${name}»`
    await notify(c, {
      userId: bar.owner_id as string, type: `revision.${decision}`, title,
      body: decision === 'approve' ? undefined : comment, link: `/panel/establecimientos/${bar.id}`,
    })
    mail = decisionMail(bar.owner_email, bar.owner_name, name, decision, comment, decision === 'approve' ? `/bares/${bar.slug}` : `/panel/establecimientos/${bar.id}`, true)
  })
  await Promise.all(filesToRemove.map(removeStored))
  if (mail) await sendMail(mail)
}

function decisionMail(to: string, ownerName: string, barName: string, decision: Decision, comment: string, path: string, isRevision = false): Mail {
  const what = isRevision ? `los cambios de «${barName}»` : `«${barName}»`
  const paragraphs =
    decision === 'approve'
      ? [`Hola, ${ownerName}.`, `Aprobamos ${what}. Ya ${isRevision ? 'están' : 'está'} visible${isRevision ? 's' : ''} en Barmap.`]
      : decision === 'request_changes'
        ? [`Hola, ${ownerName}.`, `Revisamos ${what} y necesitamos algunos ajustes antes de publicarlo.`, `Comentario: ${comment}`]
        : [`Hola, ${ownerName}.`, `Revisamos ${what} y no pudimos aprobarlo.`, `Motivo: ${comment}`, 'Puedes corregir la información y enviarla de nuevo.']
  return {
    to,
    subject: decision === 'approve' ? `Publicado en Barmap: ${barName}` : `Revisión de ${barName} en Barmap`,
    paragraphs,
    action: { label: decision === 'approve' ? 'Ver publicación' : 'Revisar y corregir', url: appLink(path) },
  }
}

// ---------------------------------------------------------------------
// Suspender / reactivar publicación
// ---------------------------------------------------------------------
export async function setBarVisibility(adminId: string, barId: string, action: 'suspend' | 'reactivate', comment: string) {
  let mail: Mail | null = null
  await withTx(async (c) => {
    const bar = await lockBarAndOwner(c, barId)
    const from = bar.publication_status
    if (action === 'suspend' && from !== 'published') throw new HttpError(409, 'Solo se pueden suspender establecimientos publicados', 'invalid_state')
    if (action === 'reactivate' && from !== 'suspended') throw new HttpError(409, 'Este establecimiento no está suspendido', 'invalid_state')
    const to = action === 'suspend' ? 'suspended' : 'published'
    await c.query(`UPDATE bars SET publication_status = $2, moderation_note = $3 WHERE id = $1`, [bar.id, to, action === 'suspend' ? comment : null])
    await logModeration(c, { adminId, entityType: 'bar', entityId: bar.id, action, previousStatus: from, newStatus: to, comment: comment || null, metadata: { name: bar.name } })
    await notify(c, {
      userId: bar.owner_id as string, type: `bar.${action}`,
      title: action === 'suspend' ? `«${bar.name}» fue retirado temporalmente` : `«${bar.name}» vuelve a estar publicado`,
      body: comment || undefined, link: `/panel/establecimientos/${bar.id}`,
    })
    mail = {
      to: bar.owner_email,
      subject: action === 'suspend' ? `Publicación retirada: ${bar.name}` : `Publicación reactivada: ${bar.name}`,
      paragraphs:
        action === 'suspend'
          ? [`Hola, ${bar.owner_name}.`, `Retiramos temporalmente «${bar.name}» de Barmap.`, `Motivo: ${comment}`, 'Responde a este correo si necesitas más información.']
          : [`Hola, ${bar.owner_name}.`, `«${bar.name}» vuelve a estar visible en Barmap.`],
      action: { label: 'Ir a mi panel', url: appLink('/panel/establecimientos') },
    }
  })
  if (mail) await sendMail(mail)
}

// ---------------------------------------------------------------------
// Edición directa por el admin (correcciones). Aplica a la versión vigente,
// incrementa la versión (invalida revisiones abiertas basadas en la anterior)
// y guarda en la auditoría qué campos cambió.
// ---------------------------------------------------------------------
export async function adminEditBar(adminId: string, barId: string, input: BarFields, comment: string) {
  await withTx(async (c) => {
    const bar = await lockBarAndOwner(c, barId)
    const live = await loadLive(c, bar)
    const data = await checkCatalog(c, input)
    const changed = diffFields({ ...live.data, imageIds: [] }, { ...data, imageIds: [] })
    if (!changed.length) throw new HttpError(422, 'No hay cambios que guardar', 'no_changes')
    if (bar.publication_status !== 'draft') {
      const missing = validateForSubmit(data, live.images)
      delete missing.images
      if (Object.keys(missing).length) throw new HttpError(422, `La edición deja el establecimiento incompleto: ${Object.values(missing).join('; ')}`, 'incomplete')
    }
    await writeLive(c, bar, data)
    await c.query(`UPDATE bars SET version = version + 1 WHERE id = $1`, [bar.id])
    await logModeration(c, {
      adminId, entityType: 'bar', entityId: bar.id, action: 'edit', previousStatus: bar.publication_status, newStatus: bar.publication_status,
      comment: comment || null, metadata: { name: data.name, changedFields: changed, before: Object.fromEntries(changed.map((k) => [k, live.data[k as keyof BarFields]])) },
    })
    await notify(c, {
      userId: bar.owner_id as string, type: 'bar.edited_by_admin', title: `Actualizamos la información de «${data.name}»`,
      body: comment || `Campos modificados: ${changed.join(', ')}`, link: `/panel/establecimientos/${bar.id}`,
    })
  })
}

// ---------------------------------------------------------------------
// Listado general de establecimientos
// ---------------------------------------------------------------------
export async function listAllBars(opts: { status?: string; q?: string; sort: 'updated' | 'submitted' | 'name' | 'views'; page: number; pageSize: number }) {
  const p = new Params()
  const where = ['b.deleted_at IS NULL']
  if (opts.status) where.push(`b.publication_status = ${p.add(opts.status)}::publication_status`)
  if (opts.q) {
    const like = p.add(`%${likeEscape(opts.q)}%`)
    where.push(`(b.name ILIKE ${like} OR b.city ILIKE ${like} OR b.neighborhood ILIKE ${like} OR u.name ILIKE ${like} OR u.email::text ILIKE ${like})`)
  }
  const order = {
    updated: 'b.updated_at DESC',
    submitted: 'b.submitted_at DESC NULLS LAST',
    name: 'lower(b.name) ASC',
    views: 'views30d DESC',
  }[opts.sort]
  const { rows } = await query(
    `SELECT b.id, b.slug, b.name, b.city, b.neighborhood, b.publication_status AS status, b.submitted_at AS "submittedAt",
            b.published_at AS "publishedAt", b.updated_at AS "updatedAt", c.name AS category,
            u.id AS "ownerId", u.name AS "ownerName", u.email AS "ownerEmail", u.account_status AS "ownerStatus",
            (SELECT coalesce(thumb_url, image_url) FROM bar_images i WHERE i.bar_id = b.id AND i.revision_id IS NULL ORDER BY is_cover DESC, sort_order LIMIT 1) AS "coverUrl",
            (SELECT status FROM bar_revisions r WHERE r.bar_id = b.id AND r.status IN ('draft', 'pending_review', 'changes_requested')) AS "revisionStatus",
            coalesce((SELECT sum(views) FROM bar_daily_stats s WHERE s.bar_id = b.id AND s.day > current_date - 30), 0)::int AS views30d,
            count(*) OVER() AS total
     FROM bars b JOIN users u ON u.id = b.owner_id LEFT JOIN categories c ON c.id = b.category_id
     WHERE ${where.join(' AND ')}
     ORDER BY ${order}, b.id
     LIMIT ${p.add(opts.pageSize)} OFFSET ${p.add((opts.page - 1) * opts.pageSize)}`,
    p.values,
  )
  const counts = await query(`SELECT publication_status AS status, count(*)::int AS n FROM bars WHERE deleted_at IS NULL GROUP BY 1`)
  const total = rows.length ? Number(rows[0].total) : 0
  return {
    items: rows.map(({ total: _t, views30d, ...r }) => ({ ...r, views30d })),
    total,
    page: opts.page,
    totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
    counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
  }
}
