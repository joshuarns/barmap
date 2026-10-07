import type { NextFunction, Request, Response } from 'express'
import { z, ZodError } from 'zod'
import multer from 'multer'
import { config } from '../config.js'
import { HttpError } from '../lib/http.js'

/**
 * Formato único de error: { error: { message, code?, details? } }.
 * Los errores inesperados nunca filtran detalles internos al cliente.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: { message: 'Hay datos que revisar', code: 'validation_error', details: z.flattenError(err).fieldErrors },
    })
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `La foto supera ${config.maxUploadBytes / 1_048_576} MB` : 'Archivo no válido'
    return res.status(413).json({ error: { message: msg, code: 'upload_error' } })
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } })
  }
  // Errores de cliente de body-parser (JSON mal formado, cuerpo demasiado grande…).
  const status = (err as { status?: number })?.status
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ error: { message: status === 413 ? 'La petición es demasiado grande' : 'La petición no es válida', code: 'bad_request' } })
  }
  console.error('[error]', err)
  res.status(500).json({ error: { message: 'Error interno del servidor', code: 'internal' } })
}
