import { env } from '@/config/env'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: Record<string, string[]>,
  ) {
    super(message)
  }
}

type QueryValue = string | number | boolean | undefined | null | (string | number)[]

/** Serializa parámetros omitiendo vacíos; los arreglos van separados por comas. */
export function toQueryString(params: Record<string, QueryValue>) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue
    if (Array.isArray(v)) {
      if (v.length) qs.set(k, v.join(','))
    } else qs.set(k, String(v === true ? 1 : v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function apiGet<T>(path: string, params: Record<string, QueryValue> = {}, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${env.apiBaseUrl}/api${path}${toQueryString(params)}`, {
      signal,
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ApiError(0, 'No pudimos conectar con Barmap. Revisa tu conexión.', 'network')
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const e = body?.error
    throw new ApiError(res.status, e?.message ?? 'Algo salió mal. Inténtalo de nuevo.', e?.code, e?.details)
  }
  return body as T
}

export async function send<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body: unknown = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${env.apiBaseUrl}/api${path}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'No pudimos conectar con Barmap. Revisa tu conexión.', 'network')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const e = data?.error
    throw new ApiError(res.status, e?.message ?? 'Algo salió mal. Inténtalo de nuevo.', e?.code, e?.details)
  }
  return data as T
}

export const apiPost = <T>(path: string, body?: unknown) => send<T>('POST', path, body)
export const apiPut = <T>(path: string, body?: unknown) => send<T>('PUT', path, body)
export const apiDelete = <T>(path: string) => send<T>('DELETE', path)

/** Subida multipart con progreso (fetch no lo expone; se usa XHR). */
export function apiUpload<T>(path: string, field: string, file: File, onProgress?: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${env.apiBaseUrl}/api${path}`)
    xhr.withCredentials = true
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      const data = xhr.response
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data as T)
      const e = data?.error
      reject(new ApiError(xhr.status, e?.message ?? 'No se pudo subir la foto.', e?.code, e?.details))
    }
    xhr.onerror = () => reject(new ApiError(0, 'No pudimos conectar con Barmap. Revisa tu conexión.', 'network'))
    const form = new FormData()
    form.append(field, file)
    xhr.send(form)
  })
}

/** Primer mensaje de error de un campo, si el servidor lo devolvió. */
export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.details?.[field]?.[0] : undefined
}
