import pg from 'pg'
import { config } from '../config.js'

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
})

/** Helper tipado para consultas parametrizadas (nunca concatenar SQL). */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params as never)
}
