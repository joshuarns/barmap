import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config.js'

/**
 * Almacenamiento de archivos. Hoy: disco local servido en /uploads.
 * Para producción se implementa la misma interfaz sobre S3 / Cloudflare R2
 * (PutObject/DeleteObject + URL pública o CDN) sin tocar el resto del código.
 */
export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<string>
  remove(key: string): Promise<void>
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_-]*\.(webp|jpg|png)$/

class LocalStorage implements Storage {
  async put(key: string, data: Buffer) {
    if (!SAFE_KEY.test(key) || key.includes('..')) throw new Error(`Clave de archivo no válida: ${key}`)
    const file = path.join(config.uploadDir, key)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, data)
    return `${config.uploadPublicUrl}/${key}`
  }

  async remove(key: string) {
    if (!SAFE_KEY.test(key) || key.includes('..')) return
    await fs.rm(path.join(config.uploadDir, key), { force: true })
  }
}

export const storage: Storage = new LocalStorage()
