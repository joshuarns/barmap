import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { config } from './config.js'
import { healthRouter } from './routes/health.js'
import { publicRouter } from './routes/public.js'
import { authRouter } from './routes/auth.js'
import { ownerApplicationRouter } from './routes/ownerApplication.js'
import { adminApplicationsRouter } from './routes/adminApplications.js'
import { ownerBarsRouter } from './routes/ownerBars.js'
import { adminPlatformRouter } from './routes/adminPlatform.js'
import { geocodeRouter } from './routes/geocode.js'
import { meRouter } from './routes/me.js'
import { authenticate, requireRole } from './middleware/auth.js'
import { csrfGuard } from './middleware/security.js'
import { errorHandler } from './middleware/errorHandler.js'
import { mountClient } from './routes/client.js'

/** Construye la app (sin escuchar): la usan el servidor y las pruebas. */
export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy)
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          // Leaflet y React usan estilos en línea (atributo style).
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://tiles.stadiamaps.com'],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'object-src': ["'none'"],
          'form-action': ["'self'"],
          'upgrade-insecure-requests': config.isProd ? [] : null,
        },
      },
      // Las fotos pueden mostrarse desde otro origen (frontend en otro dominio).
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  )
  app.use(cors({ origin: config.clientOrigin, credentials: true }))
  app.use(express.json({ limit: '200kb' }))
  app.use(cookieParser())
  app.use('/api', csrfGuard, authenticate)

  app.use('/api/health', healthRouter)
  app.use('/api', publicRouter) // /bars, /bars/:slug, /catalog, eventos y reportes
  app.use('/api/auth', authRouter)
  app.use('/api/me', meRouter)
  app.use('/api/owner', ownerApplicationRouter) // solicitud de propietario (visitantes verificados)
  app.use('/api/owner', ownerBarsRouter) // gestión de establecimientos (propietarios)
  app.use('/api/geocode', requireRole('owner', 'admin'), geocodeRouter)
  app.use('/api/admin', requireRole('admin'), adminApplicationsRouter, adminPlatformRouter)

  // Fotos subidas (en producción con S3/R2 las sirve el bucket o CDN).
  app.use(config.uploadPublicUrl, express.static(config.uploadDir, { maxAge: '30d', immutable: true, dotfiles: 'deny' }))

  app.use('/api', (_req, res) => res.status(404).json({ error: { message: 'Ruta no encontrada', code: 'not_found' } }))
  mountClient(app)
  app.use(errorHandler)
  return app
}
