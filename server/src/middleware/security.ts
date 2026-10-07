import type { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { config } from '../config.js'
import { HttpError } from '../lib/http.js'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Defensa CSRF para la cookie de sesión (además de SameSite=Lax):
 * - las mutaciones deben ser JSON (un formulario de otro sitio no puede enviarlo sin preflight CORS)
 * - si llega cabecera Origin, debe ser uno de los orígenes permitidos.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next()
  const origin = req.get('origin')
  if (origin && !config.clientOrigin.includes(origin.replace(/\/+$/, ''))) {
    return next(new HttpError(403, 'Origen no permitido', 'bad_origin'))
  }
  // Subidas de archivos: multipart permitido solo si el navegador declara un Origin válido.
  if (req.is('multipart/form-data')) {
    if (!origin) return next(new HttpError(403, 'Origen requerido', 'bad_origin'))
    return next()
  }
  // Sin cuerpo (p. ej. DELETE): basta la comprobación de origen.
  const hasBody = Number(req.get('content-length') ?? 0) > 0 || req.get('transfer-encoding') !== undefined
  if (hasBody && !req.is('application/json')) return next(new HttpError(415, 'Se esperaba JSON', 'unsupported_media_type'))
  next()
}

const limiter = (windowMinutes: number, limit: number, message: string, skipSuccessfulRequests = false) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    skipSuccessfulRequests,
    // En pruebas automatizadas los límites se desactivan (se verificaron aparte).
    skip: () => process.env.NODE_ENV === 'test',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, message, 'rate_limited')),
  })

export const limits = {
  // Solo cuentan los intentos fallidos.
  login: limiter(15, 10, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.', true),
  register: limiter(60, 5, 'Demasiados registros desde esta conexión. Inténtalo más tarde.'),
  email: limiter(60, 5, 'Ya enviamos varios correos. Revisa tu bandeja o espera un poco.'),
  application: limiter(24 * 60, 5, 'Demasiadas solicitudes hoy. Inténtalo mañana.'),
  createBar: limiter(60, 10, 'Creaste muchos establecimientos en poco tiempo. Inténtalo más tarde.'),
  upload: limiter(60, 120, 'Subiste muchas fotos en poco tiempo. Espera un poco.'),
  geocode: limiter(1, 20, 'Demasiadas búsquedas de dirección. Espera un momento.'),
  report: limiter(60, 10, 'Enviaste muchos reportes. Inténtalo más tarde.'),
  events: limiter(1, 120, 'Demasiadas peticiones.'),
}

/** Campo trampa: los humanos no lo ven; si viene con valor, es un bot. */
export function isBot(body: unknown) {
  const hp = (body as Record<string, unknown> | undefined)?.website_url
  return typeof hp === 'string' && hp.trim() !== ''
}
