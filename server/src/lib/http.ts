import type { NextFunction, Request, Response } from 'express'

/** Error con código HTTP y mensaje seguro para el cliente. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

/** Envuelve un handler async para que los errores lleguen al middleware de error. */
export function asyncHandler(fn: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}
