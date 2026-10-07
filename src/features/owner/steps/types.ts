import type { Catalog } from '@/types/api'
import type { BarFields } from '../bars'

export interface StepProps {
  form: BarFields
  set: <K extends keyof BarFields>(key: K, value: BarFields[K]) => void
  patch: (p: Partial<BarFields>) => void
  /** Errores visibles (solo tras intentar continuar o enviar). */
  errors: Record<string, string | undefined>
  catalog: Catalog
}

export const MX_STATES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila',
  'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas',
  'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
]
