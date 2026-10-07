import type { SessionUser } from '../lib/auth.js'

declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado, cargado desde la BD en cada petición. */
      user?: SessionUser
    }
  }
}

export {}
