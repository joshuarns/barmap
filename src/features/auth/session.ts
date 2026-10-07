import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import type { SessionUser } from '@/types/auth'

export const sessionKey = ['session'] as const

/**
 * Sesión actual. La cookie es httpOnly: el cliente no puede leerla, solo
 * preguntar al servidor quién es. El rol mostrado aquí sirve para la UI;
 * la autorización real ocurre en el servidor en cada petición.
 */
export function useSession() {
  const q = useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => apiGet<{ user: SessionUser | null }>('/auth/me', {}, signal).then((r) => r.user),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  return { user: q.data ?? null, isLoading: q.isLoading, refetch: q.refetch }
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => apiPost<{ user: SessionUser }>('/auth/login', body),
    onSuccess: ({ user }) => {
      qc.clear()
      qc.setQueryData(sessionKey, user)
    },
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; email: string; password: string; acceptTerms: boolean; website_url?: string }) =>
      apiPost<{ user: SessionUser }>('/auth/register', body),
    onSuccess: ({ user }) => {
      if (user) qc.setQueryData(sessionKey, user)
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost('/auth/logout'),
    onSettled: () => {
      // Borra cualquier dato privado en caché.
      qc.clear()
      qc.setQueryData(sessionKey, null)
    },
  })
}

export function useResendVerification() {
  return useMutation({ mutationFn: () => apiPost('/auth/resend-verification') })
}

/** Destino tras iniciar sesión según el rol, respetando ?next= si es una ruta interna. */
export function homeFor(user: SessionUser, next?: string | null) {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  if (user.role === 'admin') return '/admin'
  if (user.role === 'owner') return '/panel'
  if (user.application?.status === 'pending') return '/registra-tu-bar'
  return '/'
}

export const firstName = (name: string) => name.split(' ')[0]
