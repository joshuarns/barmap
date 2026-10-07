import type { NextFunction, Request, Response } from 'express'
import { HttpError } from '../lib/http.js'
import { SESSION_COOKIE, loadSessionUser, readSession, type UserRole } from '../lib/auth.js'

/**
 * Lee la cookie de sesión y carga el usuario DESDE LA BD en cada petición:
 * rol, estado y verificación nunca se toman del token ni del cliente.
 * Si token_version no coincide (suspensión, cambio de contraseña), la sesión
 * deja de ser válida.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (!token) return next()
  const payload = readSession(token)
  if (!payload) {
    res.clearCookie(SESSION_COOKIE, { path: '/' })
    return next()
  }
  try {
    const user = await loadSessionUser(payload.sub)
    if (!user || user.tokenVersion !== payload.tv) {
      res.clearCookie(SESSION_COOKIE, { path: '/' })
      return next()
    }
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Inicia sesión para continuar', 'unauthenticated'))
  next()
}

export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Inicia sesión para continuar', 'unauthenticated'))
  if (!req.user.emailVerified) return next(new HttpError(403, 'Verifica tu correo electrónico para continuar', 'email_unverified'))
  next()
}

/** Rol requerido + cuenta activa (una cuenta suspendida pierde las funciones de gestión). */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Inicia sesión para continuar', 'unauthenticated'))
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'No tienes permiso para realizar esta acción', 'forbidden'))
    if (req.user.accountStatus !== 'active') return next(new HttpError(403, 'Tu cuenta está suspendida', 'account_suspended'))
    next()
  }
}

/**
 * Propietario aprobado. Lectura permitida aunque la cuenta esté suspendida
 * (puede consultar su información); escritura solo con cuenta activa.
 */
export function requireOwner(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Inicia sesión para continuar', 'unauthenticated'))
  if (req.user.role !== 'owner') return next(new HttpError(403, 'Necesitas una cuenta de propietario aprobada', 'forbidden'))
  if (req.method !== 'GET' && req.user.accountStatus !== 'active') {
    return next(new HttpError(403, 'Tu cuenta está suspendida: no puedes realizar cambios', 'account_suspended'))
  }
  next()
}
