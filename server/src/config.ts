import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

// Mensajes de validación en español para toda la API.
z.config(z.locales.es())

const isProd = process.env.NODE_ENV === 'production'

/** Variables de entorno validadas al arrancar: si falta algo, falla rápido. */
const schema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: isProd ? z.string().min(32) : z.string().default('dev-only-secret-change-me'),
  JWT_EXPIRES_DAYS: z.coerce.number().int().min(1).max(60).default(7),
  // URL pública del sitio (enlaces en correos).
  APP_URL: z.url().default('http://localhost:5173'),
  // Sin API key, los correos se imprimen en consola (desarrollo).
  RESEND_API_KEY: z.string().default(''),
  MAIL_FROM: z.string().default('Barmap <onboarding@resend.dev>'),
  // Imágenes: carpeta local (desarrollo) y URL pública desde la que se sirven.
  UPLOAD_DIR: z.string().default('uploads'),
  UPLOAD_PUBLIC_URL: z.string().default('/uploads'),
  MAX_UPLOAD_MB: z.coerce.number().min(1).max(20).default(8),
  // Saltos de proxy de confianza (1 detrás de un balanceador; 0 en local).
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  // Carpeta del frontend compilado. Si existe, la API también sirve el sitio (un solo despliegue).
  CLIENT_DIST: z.string().default('../dist'),
})

// Una variable definida pero vacía (JWT_SECRET=) cuenta como no definida.
const rawEnv = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''))
const parsed = schema.safeParse(rawEnv)
if (!parsed.success) {
  console.error('[config] Variables de entorno inválidas:')
  for (const issue of parsed.error.issues) console.error(`  · ${issue.path.join('.')}: ${issue.message}`)
  process.exit(1)
}
const env = parsed.data

export const config = {
  isProd,
  databaseUrl: env.DATABASE_URL,
  databaseSsl: env.DATABASE_SSL === 'true',
  port: env.PORT,
  // El header Origin nunca lleva barra final: se normaliza.
  clientOrigin: env.CLIENT_ORIGIN.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean),
  jwtSecret: env.JWT_SECRET,
  jwtExpiresDays: env.JWT_EXPIRES_DAYS,
  appUrl: env.APP_URL.replace(/\/+$/, ''),
  resendApiKey: env.RESEND_API_KEY,
  mailFrom: env.MAIL_FROM,
  uploadDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', env.UPLOAD_DIR),
  uploadPublicUrl: env.UPLOAD_PUBLIC_URL.replace(/\/+$/, ''),
  maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
  trustProxy: env.TRUST_PROXY,
  clientDist: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', env.CLIENT_DIST),
}
