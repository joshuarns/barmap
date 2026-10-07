import type { LogEntry } from './platform'

export const ACTION_LABELS: Record<string, string> = {
  approve: 'aprobó',
  reject: 'rechazó',
  request_changes: 'pidió cambios en',
  suspend: 'suspendió',
  reactivate: 'reactivó',
  edit: 'editó',
  create: 'creó',
  delete: 'eliminó',
  activate: 'activó',
  deactivate: 'desactivó',
}

export const ENTITY_LABELS: Record<LogEntry['entityType'], string> = {
  user: 'Usuario',
  owner_application: 'Solicitud',
  bar: 'Establecimiento',
  bar_revision: 'Cambios de establecimiento',
  report: 'Reporte',
  category: 'Categoría',
  establishment_type: 'Tipo',
  amenity: 'Servicio',
}

export const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  description: 'Descripción',
  categoryId: 'Categoría',
  typeId: 'Tipo',
  country: 'País',
  state: 'Estado',
  city: 'Ciudad',
  neighborhood: 'Colonia',
  address: 'Dirección',
  postalCode: 'Código postal',
  latitude: 'Latitud',
  longitude: 'Longitud',
  phone: 'Teléfono',
  website: 'Sitio web',
  social: 'Redes sociales',
  priceRange: 'Precio',
  hours: 'Horarios',
  amenityIds: 'Servicios',
  imageIds: 'Fotos',
}

/** Enlace interno a la entidad de una entrada del historial. */
export function logLink(l: Pick<LogEntry, 'entityType' | 'entityId' | 'barId'>): string | null {
  switch (l.entityType) {
    case 'bar': return `/admin/moderacion/${l.entityId}`
    case 'bar_revision': return l.barId ? `/admin/moderacion/${l.barId}` : null
    case 'user': return `/admin/usuarios/${l.entityId}`
    case 'owner_application': return `/admin/solicitudes/${l.entityId}`
    case 'category': case 'establishment_type': case 'amenity': return '/admin/catalogos'
    default: return null
  }
}
