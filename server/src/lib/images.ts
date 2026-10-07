import crypto from 'node:crypto'
import sharp, { type Metadata } from 'sharp'
import { HttpError } from './http.js'
import { storage } from './storage.js'

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif'])
export const MIN_WIDTH = 1000
export const MIN_HEIGHT = 600
const LARGE_WIDTH = 2000
const THUMB_WIDTH = 720

export interface StoredImage {
  imageUrl: string
  thumbUrl: string
  storageKey: string
  width: number
  height: number
}

/**
 * Procesa una foto subida por un propietario:
 * - el formato se detecta por el CONTENIDO (no por extensión ni Content-Type)
 * - se corrige la rotación EXIF y se descartan TODOS los metadatos (incl. GPS)
 * - se recodifica a WebP (grande + miniatura), lo que neutraliza archivos manipulados
 */
export async function processAndStore(buffer: Buffer, barId: string): Promise<StoredImage> {
  let meta: Metadata
  try {
    meta = await sharp(buffer, { failOn: 'error' }).metadata()
  } catch {
    throw new HttpError(422, 'El archivo no es una imagen válida', 'invalid_image')
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new HttpError(422, 'Formato no permitido. Usa JPG, PNG, WebP o HEIC.', 'invalid_image')
  }
  // Dimensiones reales tras aplicar la orientación EXIF.
  const rotated = (meta.orientation ?? 1) >= 5
  const width = (rotated ? meta.height : meta.width) ?? 0
  const height = (rotated ? meta.width : meta.height) ?? 0
  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    throw new HttpError(422, `La foto es muy pequeña (${width}×${height}). Mínimo ${MIN_WIDTH}×${MIN_HEIGHT} px.`, 'image_too_small')
  }

  const base = sharp(buffer).rotate()
  const [large, thumb] = await Promise.all([
    base.clone().resize({ width: LARGE_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true }),
    base.clone().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer(),
  ])

  const id = crypto.randomUUID()
  const key = `bars/${barId}/${id}.webp`
  const thumbKey = `bars/${barId}/${id}_t.webp`
  const [imageUrl, thumbUrl] = await Promise.all([
    storage.put(key, large.data, 'image/webp'),
    storage.put(thumbKey, thumb, 'image/webp'),
  ])
  return { imageUrl, thumbUrl, storageKey: key, width: large.info.width, height: large.info.height }
}

export async function removeStored(storageKey: string) {
  if (storageKey.startsWith('external:')) return // fotos demo por URL
  await Promise.all([storage.remove(storageKey), storage.remove(storageKey.replace(/\.webp$/, '_t.webp'))])
}
