import { z } from 'zod'

/** Texto de una línea: recorta, colapsa espacios y elimina caracteres de control. */
export const line = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim())
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? 'Este campo es obligatorio' : `Escribe al menos ${min} caracteres`)
        .max(max, `Máximo ${max} caracteres`),
    )

/** Texto multilínea: conserva saltos de línea, quita otros caracteres de control. */
export const multiline = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim())
    .pipe(z.string().max(max, `Máximo ${max} caracteres`))

export const email = z.string().trim().toLowerCase().pipe(z.email('Correo electrónico no válido').max(160))

export const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede tener más de 72 caracteres')
  .refine((p) => /[A-Za-zÀ-ÿ]/.test(p) && /\d/.test(p), 'Usa al menos una letra y un número')

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()-]{7,25}$/, 'Teléfono no válido')

export const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .transform((s) => (s && !/^https?:\/\//i.test(s) ? `https://${s}` : s))
  .pipe(z.union([z.literal(''), z.url({ protocol: /^https?$/, message: 'URL no válida' })]))
