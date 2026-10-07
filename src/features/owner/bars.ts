import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from '@/lib/api'
import type { PublicationStatus } from '@/types/domain'

export interface HourInput {
  dayOfWeek: number
  isClosed: boolean
  opens: string | null
  closes: string | null
}

export interface BarFields {
  name: string
  description: string
  categoryId: number | null
  typeId: number | null
  country: string
  state: string
  city: string
  neighborhood: string
  address: string
  postalCode: string
  latitude: number | null
  longitude: number | null
  phone: string
  website: string
  social: { instagram: string; facebook: string; tiktok: string }
  priceRange: 1 | 2 | 3 | 4 | null
  hours: HourInput[]
  amenityIds: number[]
}

export interface WorkingImage {
  id: string
  url: string
  thumbUrl: string
}

export type RevisionStatus = 'draft' | 'pending_review' | 'changes_requested'

export interface WorkingCopy {
  bar: {
    id: string
    slug: string
    status: PublicationStatus
    moderationNote: string | null
    submittedAt: string | null
    publishedAt: string | null
    updatedAt: string
  }
  revision: { id: string; status: RevisionStatus; reviewComment: string | null; submittedAt: string | null; updatedAt: string } | null
  data: BarFields
  images: WorkingImage[]
  lockReason: string | null
  duplicates: { name: string; city: string; slug: string; isPublished: boolean; isOwn: boolean }[]
}

export interface OwnerBarRow {
  id: string
  slug: string
  name: string
  city: string | null
  neighborhood: string | null
  status: PublicationStatus
  moderationNote: string | null
  submittedAt: string | null
  publishedAt: string | null
  updatedAt: string
  category: string | null
  coverUrl: string | null
  revisionStatus: RevisionStatus | null
  revisionComment: string | null
  views30d: number
}

export interface OwnerOverview {
  total: number
  published: number
  pending: number
  changesRequested: number
  drafts: number
  views30d: number
  activity: { id: string; type: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string }[]
}

export const MIN_IMAGES = 3
export const MAX_IMAGES = 12
export const MAX_IMAGE_MB = 8

const keys = {
  all: ['owner', 'bars'] as const,
  list: ['owner', 'bars', 'list'] as const,
  detail: (id: string) => ['owner', 'bars', 'detail', id] as const,
  overview: ['owner', 'overview'] as const,
}

export function useOwnerOverview() {
  return useQuery({ queryKey: keys.overview, queryFn: ({ signal }) => apiGet<OwnerOverview>('/owner/overview', {}, signal) })
}

export function useOwnerBars() {
  return useQuery({
    queryKey: keys.list,
    queryFn: ({ signal }) => apiGet<{ items: OwnerBarRow[] }>('/owner/bars', {}, signal).then((r) => r.items),
  })
}

export function useWorkingCopy(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: ({ signal }) => apiGet<WorkingCopy>(`/owner/bars/${id}`, {}, signal),
    refetchOnWindowFocus: false,
  })
}

/** Toda mutación devuelve la copia de trabajo actualizada: se guarda en caché. */
function useBarMutation<V>(id: string, fn: (v: V) => Promise<WorkingCopy>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (wc) => {
      qc.setQueryData(keys.detail(id), wc)
      qc.invalidateQueries({ queryKey: keys.list })
      qc.invalidateQueries({ queryKey: keys.overview })
    },
  })
}

export function useCreateBar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => apiPost<WorkingCopy>('/owner/bars', { name }),
    onSuccess: (wc) => {
      qc.setQueryData(keys.detail(wc.bar.id), wc)
      qc.invalidateQueries({ queryKey: keys.list })
      qc.invalidateQueries({ queryKey: keys.overview })
    },
  })
}

export const useSaveBar = (id: string) => useBarMutation(id, (data: BarFields) => apiPut<WorkingCopy>(`/owner/bars/${id}`, data))
export const useSubmitBar = (id: string) => useBarMutation(id, () => apiPost<WorkingCopy>(`/owner/bars/${id}/submit`))
export const useDiscardRevision = (id: string) => useBarMutation(id, () => apiDelete<WorkingCopy>(`/owner/bars/${id}/revision`))
export const useReorderImages = (id: string) =>
  useBarMutation(id, (imageIds: string[]) => apiPut<WorkingCopy>(`/owner/bars/${id}/images/order`, { imageIds }))
export const useDeleteImage = (id: string) => useBarMutation(id, (imageId: string) => apiDelete<WorkingCopy>(`/owner/bars/${id}/images/${imageId}`))

export function useUploadImage(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (p: number) => void }) =>
      apiUpload<WorkingCopy>(`/owner/bars/${id}/images`, 'image', file, onProgress),
    onSuccess: (wc) => {
      qc.setQueryData(keys.detail(id), wc)
      qc.invalidateQueries({ queryKey: keys.list })
    },
  })
}

export function useDeleteBar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/owner/bars/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export interface GeocodeResult {
  label: string
  latitude: number
  longitude: number
  postalCode: string
  city: string
  state: string
  neighborhood: string
}

export const geocode = (q: string) => apiGet<{ results: GeocodeResult[] }>('/geocode', { q }).then((r) => r.results)

/** Mismas reglas que el servidor (validateForSubmit), agrupadas por paso del formulario. */
export function validateSteps(d: BarFields, imageCount: number) {
  const e: Record<string, string> = {}
  if (d.name.trim().length < 2) e.name = 'Escribe el nombre del bar'
  if (d.description.trim().length < 40) e.description = `Describe tu bar en al menos 40 caracteres (llevas ${d.description.trim().length})`
  if (!d.categoryId) e.categoryId = 'Elige una categoría'
  if (!d.typeId) e.typeId = 'Elige el tipo de establecimiento'
  if (d.address.trim().length < 5) e.address = 'Escribe la calle y el número'
  if (!d.city.trim()) e.city = 'Escribe la ciudad'
  if (!d.state.trim()) e.state = 'Escribe el estado'
  if (d.country === 'MX' && d.postalCode && !/^\d{5}$/.test(d.postalCode)) e.postalCode = 'El código postal debe tener 5 dígitos'
  if (d.latitude == null || d.longitude == null) e.location = 'Marca la ubicación en el mapa'
  if (!d.priceRange) e.priceRange = 'Elige un rango de precios'
  const open = d.hours.filter((h) => !h.isClosed)
  if (!open.length) e.hours = 'Indica al menos un día de apertura'
  else if (open.some((h) => !h.opens || !h.closes)) e.hours = 'Completa la hora de apertura y cierre de los días abiertos'
  else if (open.some((h) => h.opens === h.closes)) e.hours = 'La hora de apertura y cierre no pueden ser iguales'
  if (d.phone && !/^\+?[\d\s()-]{7,25}$/.test(d.phone.trim())) e.phone = 'Teléfono no válido'
  if (!d.phone.trim() && !d.website.trim() && !d.social.instagram.trim() && !d.social.facebook.trim() && !d.social.tiktok.trim()) {
    e.contact = 'Agrega al menos un medio de contacto (teléfono, sitio web o red social)'
  }
  if (imageCount < MIN_IMAGES) e.images = `Sube al menos ${MIN_IMAGES} fotos (llevas ${imageCount})`
  return e
}

export const STEP_FIELDS: string[][] = [
  ['name', 'description', 'categoryId', 'typeId'],
  ['address', 'city', 'state', 'postalCode', 'location', 'country', 'neighborhood'],
  ['hours', 'phone', 'website', 'contact', 'priceRange', 'amenityIds'],
  ['images'],
  [],
]

export const stepOf = (field: string) => STEP_FIELDS.findIndex((f) => f.includes(field))
