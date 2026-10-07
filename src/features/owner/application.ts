import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { sessionKey } from '@/features/auth/session'
import type { ApplicationStatus } from '@/types/domain'

export interface OwnerApplication {
  id: string
  status: ApplicationStatus
  businessName: string
  contactPhone: string
  notes: string | null
  details: { city?: string; role?: string; website?: string | null; instagram?: string | null }
  rejectionReason: string | null
  createdAt: string
  reviewedAt: string | null
}

export interface ApplicationInput {
  businessName: string
  contactPhone: string
  city: string
  role: 'owner' | 'manager' | 'marketing' | 'other'
  website: string
  instagram: string
  notes: string
  website_url: string
}

export const APPLICANT_ROLES: Record<ApplicationInput['role'], string> = {
  owner: 'Dueño o socio',
  manager: 'Gerente o encargado',
  marketing: 'Marketing o redes',
  other: 'Otro',
}

export function useMyApplications(enabled: boolean) {
  return useQuery({
    queryKey: ['owner', 'applications'],
    queryFn: ({ signal }) => apiGet<{ applications: OwnerApplication[] }>('/owner/application', {}, signal).then((r) => r.applications),
    enabled,
  })
}

export function useSubmitApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ApplicationInput) => apiPost('/owner/application', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionKey })
      qc.invalidateQueries({ queryKey: ['owner', 'applications'] })
    },
  })
}
