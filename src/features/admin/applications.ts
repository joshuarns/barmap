import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import type { AccountStatus, ApplicationStatus, UserRole } from '@/types/domain'

export interface ApplicationRow {
  id: string
  status: ApplicationStatus
  businessName: string
  createdAt: string
  reviewedAt: string | null
  city: string | null
  userId: string
  name: string
  email: string
  accountStatus: AccountStatus
  barCount: number
}

export interface ApplicationList {
  items: ApplicationRow[]
  page: number
  total: number
  totalPages: number
  counts: Partial<Record<ApplicationStatus, number>>
}

export interface ApplicationDetail {
  application: {
    id: string
    status: ApplicationStatus
    businessName: string
    contactPhone: string
    notes: string | null
    details: { city?: string; role?: string; website?: string | null; instagram?: string | null }
    rejectionReason: string | null
    createdAt: string
    reviewedAt: string | null
    reviewedBy: string | null
    userId: string
    name: string
    email: string
    role: UserRole
    accountStatus: AccountStatus
    emailVerifiedAt: string | null
    userCreatedAt: string
    lastLoginAt: string | null
  }
  previous: { id: string; status: ApplicationStatus; businessName: string; rejectionReason: string | null; createdAt: string; reviewedAt: string | null }[]
  history: { action: string; previousStatus: string | null; newStatus: string | null; comment: string | null; createdAt: string; adminName: string }[]
}

const key = ['admin', 'applications'] as const

export function useApplications(params: { status?: ApplicationStatus; q?: string; page: number }) {
  return useQuery({
    queryKey: [...key, 'list', params],
    queryFn: ({ signal }) => apiGet<ApplicationList>('/admin/applications', { ...params, pageSize: 20 }, signal),
    placeholderData: keepPreviousData,
  })
}

/** Número de solicitudes pendientes (insignia del menú). */
export function usePendingApplicationsCount(enabled = true) {
  return useQuery({
    queryKey: [...key, 'pending-count'],
    queryFn: ({ signal }) => apiGet<ApplicationList>('/admin/applications', { status: 'pending', pageSize: 1 }, signal).then((r) => r.counts.pending ?? 0),
    enabled,
    refetchInterval: 60_000,
  })
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: [...key, 'detail', id],
    queryFn: ({ signal }) => apiGet<ApplicationDetail>(`/admin/applications/${id}`, {}, signal),
  })
}

export function useDecideApplication(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { decision: 'approve' | 'reject'; reason?: string; comment?: string }) => apiPost(`/admin/applications/${id}/decision`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}
