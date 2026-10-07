import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { CookieOptions } from 'express'
import { config } from '../config.js'
import { query } from '../db/pool.js'

export const SESSION_COOKIE = 'barmap_session'
const BCRYPT_COST = 12

export type UserRole = 'visitor' | 'owner' | 'admin'
export type AccountStatus = 'active' | 'suspended'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  accountStatus: AccountStatus
  emailVerified: boolean
  tokenVersion: number
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_COST)

// Hash válido de una contraseña aleatoria: comparar contra él cuando el
// usuario no existe iguala los tiempos de respuesta (evita enumerar correos).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_COST)

export async function verifyPassword(plain: string, hash: string | null | undefined) {
  if (!hash || !hash.startsWith('$2')) {
    await bcrypt.compare(plain, DUMMY_HASH)
    return false
  }
  return bcrypt.compare(plain, hash)
}

interface SessionPayload {
  sub: string
  tv: number
}

export function signSession(user: Pick<SessionUser, 'id' | 'tokenVersion'>) {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion } satisfies SessionPayload, config.jwtSecret, {
    expiresIn: `${config.jwtExpiresDays}d`,
    algorithm: 'HS256',
  })
}

export function readSession(token: string): SessionPayload | null {
  try {
    const p = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as SessionPayload
    return typeof p.sub === 'string' && typeof p.tv === 'number' ? p : null
  } catch {
    return null
  }
}

export const sessionCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax',
  path: '/',
  maxAge: config.jwtExpiresDays * 24 * 60 * 60 * 1000,
})

export async function loadSessionUser(id: string): Promise<SessionUser | null> {
  const { rows } = await query(
    `SELECT id, name, email, role, account_status, email_verified_at IS NOT NULL AS email_verified, token_version
     FROM users WHERE id = $1`,
    [id],
  )
  const u = rows[0]
  if (!u) return null
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    accountStatus: u.account_status,
    emailVerified: u.email_verified,
    tokenVersion: u.token_version,
  }
}

// ---------------------------------------------------------------------
// Tokens de un solo uso (verificación de correo, restablecer contraseña)
// Se envía el token en claro por correo y solo se guarda su sha256.
// ---------------------------------------------------------------------
type TokenPurpose = 'email_verification' | 'password_reset'
const TTL_MINUTES: Record<TokenPurpose, number> = { email_verification: 48 * 60, password_reset: 60 }

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

export async function createOneTimeToken(userId: string, purpose: TokenPurpose) {
  const token = crypto.randomBytes(32).toString('base64url')
  // Invalida tokens previos del mismo tipo.
  await query(`UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`, [userId, purpose])
  await query(
    `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [userId, purpose, sha256(token), String(TTL_MINUTES[purpose])],
  )
  return token
}

/** Marca el token como usado y devuelve el user_id si era válido. Atómico. */
export async function consumeOneTimeToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  const { rows } = await query(
    `UPDATE auth_tokens SET used_at = now()
     WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [sha256(token), purpose],
  )
  return rows[0]?.user_id ?? null
}
