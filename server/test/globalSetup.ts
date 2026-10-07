import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

/**
 * Base de datos de pruebas desechable: se recrea, se aplica el esquema y la
 * semilla de demostración. Nunca toca la base de desarrollo.
 */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/barmap_test')
  const dbName = url.pathname.slice(1)
  if (!/test/.test(dbName)) throw new Error(`Por seguridad, la base de pruebas debe contener "test" en su nombre (${dbName})`)
  const admin = new URL(url)
  admin.pathname = '/postgres'
  const c = new pg.Client({ connectionString: admin.toString() })
  await c.connect()
  await c.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
  await c.query(`CREATE DATABASE "${dbName}"`)
  await c.end()

  const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: url.toString(), UPLOAD_DIR: 'test/.uploads', RESEND_API_KEY: '' }
  const tsx = path.resolve('node_modules/.bin/tsx')
  execFileSync(tsx, ['src/db/migrate.ts'], { env, stdio: 'ignore' })
  execFileSync(tsx, ['src/db/seed.ts'], { env, stdio: 'ignore' })

  return () => fs.rmSync('test/.uploads', { recursive: true, force: true })
}
