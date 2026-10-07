import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost, apiPut, send } from '@/lib/api'
import type { BarFields, RevisionStatus, WorkingImage } from '@/features/owner/bars'
import type { AccountStatus, ApplicationStatus, PublicationStatus, UserRole } from '@/types/domain'

export interface LogEntry {
  id: string
  entityType: 'user' | 'owner_application' | 'bar' | 'bar_revision' | 'report' | 'category' | 'establishment_type' | 'amenity'
  entityId: string
  action: string
  previousStatus: string | null
  newStatus: string | null
  comment: string | null
  createdAt: string
  metadata: Record<string, unknown>
  adminId: string
  adminName: string
  entityLabel: string | null
  barId: string | null
}

export interface AdminOverview {
  owners: number
  visitors: number
  pendingApplications: number
  bars: number
  pendingReviews: number
  published: number
  suspended: number
  suspendedUsers: number
  views30d: number
  openReports: number
  recent: LogEntry[]
}

export interface QueueItem {
  kind: 'new' | 'revision'
  barId: string
  revisionId: string | null
  name: string
  city: string | null
  neighborhood: string | null
  submittedAt: string | null
  changedFields: string[] | null
  ownerName: string
  ownerEmail: string
  ownerStatus: AccountStatus
  coverUrl: string | null
  duplicateCount: number
}

export interface ReviewDetail {
  bar: { id: string; slug: string; status: PublicationStatus; moderationNote: string | null; submittedAt: string | null; publishedAt: string | null; updatedAt: string; createdAt: string; version: number; verifiedAt: string | null; openReports: number }
  data: BarFields
  images: WorkingImage[]
  missing: Record<string, string>
  revision: {
    id: string
    status: RevisionStatus
    submittedAt: string | null
    reviewComment: string | null
    changedFields: string[]
    outdated: boolean
    data: BarFields
    images: WorkingImage[]
    addedImageIds: string[]
    removedImageIds: string[]
  } | null
  owner: { id: string; name: string; email: string; accountStatus: AccountStatus; role: UserRole; createdAt: string; businessName: string | null; contactPhone: string | null; barCount: number; publishedCount: number }
  duplicates: { id: string; name: string; city: string; slug: string; status: PublicationStatus; ownerName: string; sameOwner: boolean }[]
  history: { action: string; entityType: string; previousStatus: string | null; newStatus: string | null; comment: string | null; createdAt: string; adminName: string }[]
}

export interface AdminBarRow {
  id: string
  slug: string
  name: string
  city: string | null
  neighborhood: string | null
  status: PublicationStatus
  submittedAt: string | null
  publishedAt: string | null
  updatedAt: string
  category: string | null
  ownerId: string
  ownerName: string
  ownerEmail: string
  ownerStatus: AccountStatus
  coverUrl: string | null
  revisionStatus: RevisionStatus | null
  views30d: number
}

export interface AdminUserRow {
  id: string
  name: string
  email: string
  role: UserRole
  accountStatus: AccountStatus
  createdAt: string
  emailVerified: boolean
  lastLoginAt: string | null
  applicationStatus: ApplicationStatus | null
  barCount: number
}

export interface AdminUserDetail {
  user: { id: string; name: string; email: string; role: UserRole; accountStatus: AccountStatus; suspendedReason: string | null; emailVerifiedAt: string | null; createdAt: string; lastLoginAt: string | null }
  applications: { id: string; status: ApplicationStatus; businessName: string; rejectionReason: string | null; createdAt: string; reviewedAt: string | null }[]
  bars: { id: string; name: string; slug: string; city: string | null; status: PublicationStatus; updatedAt: string; coverUrl: string | null }[]
  history: { action: string; entityType: string; comment: string | null; createdAt: string; adminName: string }[]
}

export type CatalogKind = 'categories' | 'types' | 'amenities'
export interface CatalogRow { id: number; name: string; slug: string; icon: string | null; sortOrder: number; isActive: boolean; usage: number }

interface Paged<T> { items: T[]; total: number; page: number; totalPages: number }

const k = {
  all: ['admin'] as const,
  overview: ['admin', 'overview'] as const,
  queue: (p: object) => ['admin', 'moderation', p] as const,
  review: (id: string) => ['admin', 'review', id] as const,
  bars: (p: object) => ['admin', 'bars', p] as const,
  users: (p: object) => ['admin', 'users', p] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  catalog: (kind: CatalogKind) => ['admin', 'catalog', kind] as const,
  logs: (p: object) => ['admin', 'logs', p] as const,
}

export const useAdminOverview = () => useQuery({ queryKey: k.overview, queryFn: ({ signal }) => apiGet<AdminOverview>('/admin/overview', {}, signal) })

export const useModerationQueue = (p: { kind?: 'new' | 'revision'; q?: string; page: number }) =>
  useQuery({
    queryKey: k.queue(p),
    queryFn: ({ signal }) => apiGet<Paged<QueueItem> & { counts: { new: number; revision: number } }>('/admin/moderation', { ...p, pageSize: 20 }, signal),
    placeholderData: keepPreviousData,
  })

/** Total por revisar (insignia del menú). */
export const useModerationCount = () =>
  useQuery({
    queryKey: ['admin', 'moderation', 'count'],
    queryFn: ({ signal }) => apiGet<{ counts: { new: number; revision: number } }>('/admin/moderation', { pageSize: 1 }, signal).then((r) => r.counts.new + r.counts.revision),
    refetchInterval: 60_000,
  })

export const useReview = (id: string) => useQuery({ queryKey: k.review(id), queryFn: ({ signal }) => apiGet<ReviewDetail>(`/admin/bars/${id}`, {}, signal) })

/** Mutaciones sobre un bar: guardan la respuesta e invalidan listados del admin. */
function useBarAction<V>(id: string, fn: (v: V) => Promise<ReviewDetail>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (d) => {
      qc.setQueryData(k.review(id), d)
      qc.invalidateQueries({ queryKey: ['admin', 'moderation'] })
      qc.invalidateQueries({ queryKey: ['admin', 'bars'] })
      qc.invalidateQueries({ queryKey: k.overview })
      qc.invalidateQueries({ queryKey: ['admin', 'logs'] })
      qc.invalidateQueries({ queryKey: ['bars'] }) // caché pública
    },
  })
}

export const useBarDecision = (id: string) =>
  useBarAction(id, (b: { target: 'bar' | 'revision'; decision: 'approve' | 'reject' | 'request_changes'; comment?: string }) =>
    apiPost<ReviewDetail>(`/admin/bars/${id}/decision`, b))
export const useBarVisibility = (id: string) =>
  useBarAction(id, (b: { action: 'suspend' | 'reactivate'; comment?: string }) => apiPost<ReviewDetail>(`/admin/bars/${id}/visibility`, b))
export const useBarVerify = (id: string) =>
  useBarAction(id, (b: { verified: boolean; note?: string }) => apiPost<ReviewDetail>(`/admin/bars/${id}/verify`, b))
export const useAdminEditBar = (id: string) =>
  useBarAction(id, (b: { data: BarFields; comment?: string }) => apiPut<ReviewDetail>(`/admin/bars/${id}`, b))

export const useAdminBars = (p: { status?: PublicationStatus; q?: string; sort: string; page: number }) =>
  useQuery({
    queryKey: k.bars(p),
    queryFn: ({ signal }) => apiGet<Paged<AdminBarRow> & { counts: Partial<Record<PublicationStatus, number>> }>('/admin/bars', { ...p, pageSize: 20 }, signal),
    placeholderData: keepPreviousData,
  })

export const useAdminUsers = (p: { role?: UserRole; status?: AccountStatus; q?: string; sort: string; page: number }) =>
  useQuery({
    queryKey: k.users(p),
    queryFn: ({ signal }) => apiGet<Paged<AdminUserRow> & { counts: Partial<Record<UserRole, number>> }>('/admin/users', { ...p, pageSize: 20 }, signal),
    placeholderData: keepPreviousData,
  })

export const useAdminUser = (id: string) => useQuery({ queryKey: k.user(id), queryFn: ({ signal }) => apiGet<AdminUserDetail>(`/admin/users/${id}`, {}, signal) })

export function useUserStatus(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { action: 'suspend' | 'reactivate'; reason?: string }) => apiPost<AdminUserDetail>(`/admin/users/${id}/status`, b),
    onSuccess: (d) => {
      qc.setQueryData(k.user(id), d)
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      qc.invalidateQueries({ queryKey: k.overview })
      qc.invalidateQueries({ queryKey: ['admin', 'logs'] })
      qc.invalidateQueries({ queryKey: ['bars'] })
    },
  })
}

export const useCatalogAdmin = (kind: CatalogKind) =>
  useQuery({ queryKey: k.catalog(kind), queryFn: ({ signal }) => apiGet<{ items: CatalogRow[] }>(`/admin/catalog/${kind}`, {}, signal).then((r) => r.items) })

export function useCatalogMutations(kind: CatalogKind) {
  const qc = useQueryClient()
  const done = (r: { items: CatalogRow[] }) => {
    qc.setQueryData(k.catalog(kind), r.items)
    qc.invalidateQueries({ queryKey: ['catalog'] }) // catálogo público
    qc.invalidateQueries({ queryKey: ['admin', 'logs'] })
  }
  return {
    create: useMutation({ mutationFn: (b: { name: string; icon?: string | null }) => apiPost<{ items: CatalogRow[] }>(`/admin/catalog/${kind}`, b), onSuccess: done }),
    update: useMutation({
      mutationFn: ({ id, ...b }: { id: number; name?: string; icon?: string | null; isActive?: boolean; sortOrder?: number }) =>
        send<{ items: CatalogRow[] }>('PATCH', `/admin/catalog/${kind}/${id}`, b),
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: (id: number) => apiDelete<{ items: CatalogRow[] }>(`/admin/catalog/${kind}/${id}`), onSuccess: done }),
  }
}

export const useAdminLogs = (p: { entityType?: string; action?: string; q?: string; from?: string; to?: string; page: number }) =>
  useQuery({
    queryKey: k.logs(p),
    queryFn: ({ signal }) => apiGet<Paged<LogEntry>>('/admin/logs', { ...p, pageSize: 25 }, signal),
    placeholderData: keepPreviousData,
  })

export { k as adminKeys }
