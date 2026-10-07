/**
 * Enumeraciones del dominio. Deben coincidir con los tipos ENUM de
 * server/src/db/schema.sql. El servidor es la fuente de verdad: el cliente
 * solo las usa para mostrar etiquetas y estilos.
 */

export const USER_ROLES = ['visitor', 'owner', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const ACCOUNT_STATUSES = ['active', 'suspended'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

export const APPLICATION_STATUSES = ['pending', 'approved', 'rejected'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const PUBLICATION_STATUSES = [
  'draft',
  'pending_review',
  'published',
  'changes_requested',
  'rejected',
  'suspended',
] as const
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number]

export type PriceRange = 1 | 2 | 3 | 4

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = lunes

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Lunes',
  1: 'Martes',
  2: 'Miércoles',
  3: 'Jueves',
  4: 'Viernes',
  5: 'Sábado',
  6: 'Domingo',
}

export type { BarSummary } from './api'
