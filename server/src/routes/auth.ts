import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import {
  SESSION_COOKIE, consumeOneTimeToken, createOneTimeToken, hashPassword, loadSessionUser, sessionCookieOptions,
  signSession, verifyPassword, type SessionUser,
} from '../lib/auth.js'
import { appLink, sendMail } from '../lib/mailer.js'
import { email, line, password } from '../lib/validation.js'
import { requireAuth } from '../middleware/auth.js'
import { isBot, limits } from '../middleware/security.js'

export const authRouter = Router()

/** Lo que el cliente puede saber de su propia sesión. */
async function serializeMe(user: SessionUser) {
  const { rows } = await query(
    `SELECT id, application_status, business_name, rejection_reason, created_at, reviewed_at
     FROM owner_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [user.id],
  )
  const app = rows[0]
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    emailVerified: user.emailVerified,
    application: app
      ? {
          id: app.id,
          status: app.application_status,
          businessName: app.business_name,
          rejectionReason: app.rejection_reason,
          createdAt: app.created_at,
          reviewedAt: app.reviewed_at,
        }
      : null,
  }
}

async function sendVerification(user: { id: string; name: string; email: string }) {
  const token = await createOneTimeToken(user.id, 'email_verification')
  await sendMail({
    to: user.email,
    subject: 'Confirma tu correo en Barmap',
    paragraphs: [`Hola, ${user.name}.`, 'Confirma tu correo electrónico para activar todas las funciones de tu cuenta. El enlace vence en 48 horas.'],
    action: { label: 'Confirmar correo', url: appLink(`/verificar-correo?token=${token}`) },
  })
}

function startSession(res: import('express').Response, user: Pick<SessionUser, 'id' | 'tokenVersion'>) {
  res.cookie(SESSION_COOKIE, signSession(user), sessionCookieOptions())
}

// --- Registro ---------------------------------------------------------
const registerSchema = z.object({
  name: line(2, 120),
  email,
  password,
  acceptTerms: z.literal(true, { error: 'Debes aceptar los términos' }),
})

authRouter.post(
  '/register',
  limits.register,
  asyncHandler(async (req, res) => {
    if (isBot(req.body)) return res.status(201).json({ ok: true }) // se descarta en silencio
    const data = registerSchema.parse(req.body)
    const hash = await hashPassword(data.password)
    // Rol siempre 'visitor' al registrarse: nadie puede autoasignarse otro rol.
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role, last_login_at) VALUES ($1, $2, $3, 'visitor', now())
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      [data.name, data.email, hash],
    )
    if (!rows[0]) {
      throw new HttpError(409, 'Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.', 'email_taken', {
        email: ['Este correo ya está registrado'],
      })
    }
    const user = (await loadSessionUser(rows[0].id))!
    await sendVerification(user)
    startSession(res, user)
    res.status(201).json({ user: await serializeMe(user) })
  }),
)

// --- Inicio y cierre de sesión ---------------------------------------
const loginSchema = z.object({ email, password: z.string().min(1).max(200) })

authRouter.post(
  '/login',
  limits.login,
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body)
    const { rows } = await query(`SELECT id, password_hash FROM users WHERE email = $1`, [data.email])
    const ok = await verifyPassword(data.password, rows[0]?.password_hash)
    // Mismo mensaje exista o no el correo.
    if (!ok) throw new HttpError(401, 'Correo o contraseña incorrectos', 'invalid_credentials')
    await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [rows[0].id])
    const user = (await loadSessionUser(rows[0].id))!
    startSession(res, user)
    res.json({ user: await serializeMe(user) })
  }),
)

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: undefined })
  res.json({ ok: true })
})

authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({ user: req.user ? await serializeMe(req.user) : null })
  }),
)

// --- Verificación de correo -----------------------------------------
const tokenSchema = z.object({ token: z.string().min(20).max(200) })

authRouter.post(
  '/verify-email',
  limits.email,
  asyncHandler(async (req, res) => {
    const { token } = tokenSchema.parse(req.body)
    const userId = await consumeOneTimeToken(token, 'email_verification')
    if (!userId) throw new HttpError(400, 'El enlace no es válido o ya venció. Solicita uno nuevo.', 'invalid_token')
    await query(`UPDATE users SET email_verified_at = coalesce(email_verified_at, now()) WHERE id = $1`, [userId])
    res.json({ ok: true })
  }),
)

authRouter.post(
  '/resend-verification',
  requireAuth,
  limits.email,
  asyncHandler(async (req, res) => {
    if (!req.user!.emailVerified) await sendVerification(req.user!)
    res.json({ ok: true })
  }),
)

// --- Recuperar contraseña -------------------------------------------
authRouter.post(
  '/forgot-password',
  limits.email,
  asyncHandler(async (req, res) => {
    const { email: addr } = z.object({ email }).parse(req.body)
    const { rows } = await query(`SELECT id, name, email FROM users WHERE email = $1`, [addr])
    if (rows[0]) {
      const token = await createOneTimeToken(rows[0].id, 'password_reset')
      await sendMail({
        to: rows[0].email,
        subject: 'Restablece tu contraseña de Barmap',
        paragraphs: [`Hola, ${rows[0].name}.`, 'Recibimos una solicitud para restablecer tu contraseña. El enlace vence en 1 hora. Si no fuiste tú, ignora este correo.'],
        action: { label: 'Crear nueva contraseña', url: appLink(`/restablecer-contrasena?token=${token}`) },
      })
    }
    // Misma respuesta exista o no la cuenta.
    res.json({ ok: true })
  }),
)

authRouter.post(
  '/reset-password',
  limits.email,
  asyncHandler(async (req, res) => {
    const data = tokenSchema.extend({ password }).parse(req.body)
    const userId = await consumeOneTimeToken(data.token, 'password_reset')
    if (!userId) throw new HttpError(400, 'El enlace no es válido o ya venció. Solicita uno nuevo.', 'invalid_token')
    // token_version++ cierra todas las sesiones abiertas. Quien recibe el correo lo verifica de paso.
    await query(
      `UPDATE users SET password_hash = $2, token_version = token_version + 1,
         email_verified_at = coalesce(email_verified_at, now()) WHERE id = $1`,
      [userId, await hashPassword(data.password)],
    )
    res.clearCookie(SESSION_COOKIE, { path: '/' })
    res.json({ ok: true })
  }),
)
