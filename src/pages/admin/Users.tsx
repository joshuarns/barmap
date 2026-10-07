import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Users as UsersIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { ErrorState } from '@/components/ErrorState'
import { AccountStatusBadge, ApplicationStatusBadge, Avatar, Badge, Card, Chip, EmptyState, Input, Pagination, Select, Skeleton, Tabs } from '@/components/ui'
import { useAdminUsers } from '@/features/admin/platform'
import { useDebounced } from '@/hooks/useDebounced'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import type { UserRole } from '@/types/domain'

export const ROLE_LABEL: Record<UserRole, string> = { visitor: 'Usuario', owner: 'Propietario', admin: 'Admin' }

export default function Users() {
  const [params, setParams] = useSearchParams()
  const role = (params.get('rol') as UserRole | null) ?? undefined
  const suspendedOnly = params.get('estado') === 'suspended'
  const sort = params.get('orden') || 'recent'
  const page = Number(params.get('page')) || 1
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim())
  const users = useAdminUsers({ role, status: suspendedOnly ? 'suspended' : undefined, q: dq || undefined, sort, page })
  useDocumentMeta({ title: 'Usuarios' })

  const set = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k)
    setParams(n, { replace: true })
  }
  const c = users.data?.counts ?? {}

  return (
    <>
      <PageHeader title="Usuarios" description="Propietarios, usuarios registrados y administradores." />
      <Tabs
        className="mb-4"
        value={role ?? 'all'}
        onChange={(v) => set({ rol: v === 'all' ? undefined : v, page: undefined })}
        tabs={[
          { value: 'all', label: 'Todos', count: (c.owner ?? 0) + (c.visitor ?? 0) + (c.admin ?? 0) },
          { value: 'owner', label: 'Propietarios', count: c.owner ?? 0 },
          { value: 'visitor', label: 'Usuarios', count: c.visitor ?? 0 },
          { value: 'admin', label: 'Admins', count: c.admin ?? 0 },
        ]}
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1"><Input leading={<Search />} value={q} onChange={(e) => { setQ(e.target.value); set({ page: undefined }) }} placeholder="Nombre o correo" aria-label="Buscar usuarios" className="h-11" /></div>
        <Chip selected={suspendedOnly} onClick={() => set({ estado: suspendedOnly ? undefined : 'suspended', page: undefined })}>Solo suspendidos</Chip>
        <div className="sm:w-52">
          <Select value={sort} onChange={(e) => set({ orden: e.target.value === 'recent' ? undefined : e.target.value })} className="h-11" aria-label="Ordenar">
            <option value="recent">Más recientes</option>
            <option value="name">Nombre</option>
            <option value="bars">Con más bares</option>
          </Select>
        </div>
      </div>

      {users.isError ? (
        <Card><ErrorState error={users.error} onRetry={() => users.refetch()} /></Card>
      ) : users.data && users.data.items.length === 0 ? (
        <Card><EmptyState icon={UsersIcon} title="Sin resultados" description="No hay usuarios con estos filtros." /></Card>
      ) : (
        <Card className={cn('overflow-x-auto', users.isPlaceholderData && 'opacity-60')}>
          <table className="w-full text-left text-[15px]">
            <thead className="hidden border-b border-line bg-subtle text-xs font-bold uppercase tracking-[0.06em] text-fg-subtle md:table-header-group">
              <tr><th className="px-5 py-3">Nombre</th><th className="px-5 py-3">Rol</th><th className="px-5 py-3">Registro</th><th className="px-5 py-3">Solicitud</th><th className="px-5 py-3 text-right">Bares</th><th className="px-5 py-3">Cuenta</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!users.data
                ? Array.from({ length: 5 }, (_, i) => <tr key={i}><td colSpan={6} className="p-4"><Skeleton className="h-10" /></td></tr>)
                : users.data.items.map((u) => (
                    <tr key={u.id} className="relative block p-4 hover:bg-subtle md:table-row md:p-0">
                      <td className="md:px-5 md:py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} size="sm" />
                          <div className="min-w-0">
                            <Link to={`/admin/usuarios/${u.id}`} className="font-semibold after:absolute after:inset-0 hover:underline">{u.name}</Link>
                            <p className="truncate text-sm text-fg-muted">{u.email}{!u.emailVerified && ' · sin verificar'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="mt-2 inline-block pl-11 md:mt-0 md:table-cell md:px-5 md:py-3"><Badge>{ROLE_LABEL[u.role]}</Badge></td>
                      <td className="hidden text-fg-muted md:table-cell md:px-5 md:py-3">{formatDate(u.createdAt)}</td>
                      <td className="hidden md:table-cell md:px-5 md:py-3">{u.applicationStatus ? <ApplicationStatusBadge status={u.applicationStatus} /> : <span className="text-fg-subtle">—</span>}</td>
                      <td className="hidden text-right tabular-nums md:table-cell md:px-5 md:py-3">{u.barCount}</td>
                      <td className="ml-2 inline-block md:ml-0 md:table-cell md:px-5 md:py-3"><AccountStatusBadge status={u.accountStatus} /></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </Card>
      )}
      {users.data && <Pagination className="mt-8" page={users.data.page} totalPages={users.data.totalPages} onChange={(p) => set({ page: String(p) })} />}
    </>
  )
}
