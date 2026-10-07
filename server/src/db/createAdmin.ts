/**
 * Crea (o promueve) una cuenta de administrador. Es la ÚNICA vía para obtener
 * el rol admin: la API nunca lo asigna. Requiere acceso a la base de datos.
 *
 *   npm run create-admin -- --email ana@barmap.mx --name "Ana López"
 *
 * Contraseña: variable ADMIN_PASSWORD o, si no existe, se genera una segura y
 * se muestra una sola vez.
 */
import crypto from 'node:crypto'
import { parseArgs } from 'node:util'
import { pool } from './pool.js'
import { hashPassword } from '../lib/auth.js'

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } })
const email = values.email?.trim().toLowerCase()
const name = values.name?.trim()

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
  console.error('Uso: npm run create-admin -- --email correo@dominio --name "Nombre"')
  process.exit(1)
}

const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url')
if (password.length < 12) {
  console.error('ADMIN_PASSWORD debe tener al menos 12 caracteres')
  process.exit(1)
}

const { rows } = await pool.query(
  `INSERT INTO users (name, email, password_hash, role, email_verified_at)
   VALUES ($1, $2, $3, 'admin', now())
   ON CONFLICT (email) DO UPDATE SET role = 'admin', account_status = 'active', password_hash = EXCLUDED.password_hash,
     token_version = users.token_version + 1, email_verified_at = coalesce(users.email_verified_at, now())
   RETURNING id, (xmax = 0) AS created`,
  [name, email, await hashPassword(password)],
)
console.log(`✔ Administrador ${rows[0].created ? 'creado' : 'actualizado'}: ${email}`)
if (!process.env.ADMIN_PASSWORD) console.log(`  Contraseña generada (guárdala ahora, no se vuelve a mostrar): ${password}`)
await pool.end()
