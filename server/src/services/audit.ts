import type { PoolClient } from 'pg'

type Entity = 'user' | 'owner_application' | 'bar' | 'bar_revision' | 'report' | 'category' | 'establishment_type' | 'amenity'

/** Registra una acción administrativa. Debe llamarse dentro de la misma transacción que el cambio. */
export async function logModeration(
  client: PoolClient,
  e: { adminId: string; entityType: Entity; entityId: string; action: string; previousStatus?: string | null; newStatus?: string | null; comment?: string | null; metadata?: object },
) {
  await client.query(
    `INSERT INTO moderation_logs (admin_id, entity_type, entity_id, action, previous_status, new_status, comment, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [e.adminId, e.entityType, e.entityId, e.action, e.previousStatus ?? null, e.newStatus ?? null, e.comment ?? null, JSON.stringify(e.metadata ?? {})],
  )
}

export async function notify(client: PoolClient, n: { userId: string; type: string; title: string; body?: string; link?: string }) {
  await client.query(`INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, $2, $3, $4, $5)`, [
    n.userId, n.type, n.title, n.body ?? null, n.link ?? null,
  ])
}
