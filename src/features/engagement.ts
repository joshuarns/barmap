import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui'
import { useSession } from '@/features/auth/session'
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api'
import { env } from '@/config/env'
import type { BarSummary } from '@/types/api'
import type { PublicationStatus } from '@/types/domain'

// ---------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------
const favKeys = { ids: ['me', 'favorites', 'ids'] as const, list: ['me', 'favorites', 'list'] as const }

export function useFavoriteIds() {
  const { user } = useSession()
  return useQuery({
    queryKey: favKeys.ids,
    queryFn: ({ signal }) => apiGet<{ ids: string[] }>('/me/favorites/ids', {}, signal).then((r) => new Set(r.ids)),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

export function useFavoritesList(coords?: { lat: number; lng: number }) {
  const { user } = useSession()
  return useQuery({
    queryKey: [...favKeys.list, coords ?? null],
    queryFn: ({ signal }) => apiGet<{ items: BarSummary[] }>('/me/favorites', { lat: coords?.lat, lng: coords?.lng }, signal).then((r) => r.items),
    enabled: !!user,
  })
}

/**
 * Guardar/quitar favorito con actualización optimista. Sin sesión, lleva a
 * iniciar sesión y vuelve a la misma página.
 */
export function useFavoriteAction() {
  const { user } = useSession()
  const ids = useFavoriteIds()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const mutation = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => (on ? apiPut(`/me/favorites/${id}`) : apiDelete(`/me/favorites/${id}`)),
    onMutate: async ({ id, on }) => {
      await qc.cancelQueries({ queryKey: favKeys.ids })
      const prev = qc.getQueryData<Set<string>>(favKeys.ids)
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      qc.setQueryData(favKeys.ids, next)
      return { prev }
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(favKeys.ids, ctx?.prev)
      toast({ tone: 'error', title: 'No se pudo actualizar tus favoritos', description: (e as Error).message })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: favKeys.list }),
  })

  return {
    isFavorite: (id: string) => !!ids.data?.has(id),
    toggle: (bar: Pick<BarSummary, 'id' | 'name'>) => {
      if (!user) {
        toast({ tone: 'info', title: 'Inicia sesión para guardar bares', description: 'Así los tendrás a mano en cualquier dispositivo.' })
        navigate(`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`)
        return
      }
      const on = !ids.data?.has(bar.id)
      mutation.mutate({ id: bar.id, on })
      toast({ tone: 'success', title: on ? 'Guardado en favoritos' : 'Quitado de favoritos', description: bar.name })
    },
  }
}

// ---------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------
export interface Notification { id: string; type: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string }

export function useNotifications() {
  const { user } = useSession()
  return useQuery({
    queryKey: ['me', 'notifications'],
    queryFn: ({ signal }) => apiGet<{ items: Notification[]; unread: number }>('/me/notifications', {}, signal),
    enabled: !!user,
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids?: string[]) => apiPost<{ items: Notification[]; unread: number }>('/me/notifications/read', ids ? { ids } : {}),
    onSuccess: (d) => qc.setQueryData(['me', 'notifications'], d),
  })
}

// ---------------------------------------------------------------------
// Analítica y reportes
// ---------------------------------------------------------------------
/** Evento anónimo (visita, cómo llegar, compartir). Silencioso: nunca molesta al usuario. */
export function trackEvent(slug: string, type: 'view' | 'directions' | 'share') {
  try {
    fetch(`${env.apiBaseUrl}/api/bars/${encodeURIComponent(slug)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
      keepalive: true,
      credentials: 'include',
    }).catch(() => {})
  } catch {
    /* ignorar */
  }
}

export type ReportReason = 'wrong_info' | 'closed_permanently' | 'inappropriate' | 'duplicate' | 'other'
export const REPORT_REASONS: Record<ReportReason, string> = {
  wrong_info: 'La información es incorrecta (horario, dirección, teléfono…)',
  closed_permanently: 'Cerró de forma permanente',
  inappropriate: 'Contenido inapropiado u ofensivo',
  duplicate: 'Está duplicado',
  other: 'Otro motivo',
}

export const useReportBar = (slug: string) =>
  useMutation({ mutationFn: (b: { reason: ReportReason; details: string; website_url: string }) => apiPost(`/bars/${slug}/reports`, b) })

// ---------------------------------------------------------------------
// Estadísticas del propietario
// ---------------------------------------------------------------------
export interface StatsPoint { day: string; views: number; directions: number; shares: number; favorites: number }
export interface OwnerStats {
  days: number
  series: StatsPoint[]
  bars: { id: string; name: string; slug: string; status: PublicationStatus; views: number; directions: number; shares: number; favorites: number; savedBy: number }[]
}

export const useOwnerStats = (days: number) =>
  useQuery({ queryKey: ['owner', 'stats', days], queryFn: ({ signal }) => apiGet<OwnerStats>('/owner/stats', { days }, signal), placeholderData: keepPreviousData })

// ---------------------------------------------------------------------
// Reportes (admin)
// ---------------------------------------------------------------------
export interface AdminReport {
  id: string
  reason: ReportReason
  details: string | null
  status: 'open' | 'resolved' | 'dismissed'
  createdAt: string
  resolvedAt: string | null
  resolutionNote: string | null
  barId: string
  barName: string
  barSlug: string
  city: string | null
  barStatus: PublicationStatus
  reporterName: string | null
  resolvedBy: string | null
  openForBar: number
}

export const useAdminReports = (p: { status?: AdminReport['status']; page: number }) =>
  useQuery({
    queryKey: ['admin', 'reports', p],
    queryFn: ({ signal }) =>
      apiGet<{ items: AdminReport[]; page: number; totalPages: number; counts: Partial<Record<AdminReport['status'], number>> }>('/admin/reports', { ...p, pageSize: 20 }, signal),
    placeholderData: keepPreviousData,
  })

export const useOpenReportsCount = () =>
  useQuery({
    queryKey: ['admin', 'reports', 'count'],
    queryFn: ({ signal }) => apiGet<{ counts: { open?: number } }>('/admin/reports', { status: 'open', pageSize: 1 }, signal).then((r) => r.counts.open ?? 0),
    refetchInterval: 60_000,
  })

export function useResolveReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...b }: { id: string; action: 'resolve' | 'dismiss'; note?: string }) => apiPost(`/admin/reports/${id}/resolve`, b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reports'] })
      qc.invalidateQueries({ queryKey: ['admin', 'logs'] })
      qc.invalidateQueries({ queryKey: ['admin', 'overview'] })
    },
  })
}
