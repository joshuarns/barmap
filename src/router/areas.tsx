import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RequireRole } from '@/components/auth/guards'
import { useSession } from '@/features/auth/session'
import { usePendingApplicationsCount } from '@/features/admin/applications'
import { useModerationCount } from '@/features/admin/platform'
import { useOpenReportsCount } from '@/features/engagement'
import { OWNER_NAV } from '@/pages/owner/nav'
import { ADMIN_NAV } from '@/pages/admin/nav'

export function OwnerArea() {
  const { user } = useSession()
  return (
    <RequireRole roles={['owner']}>
      <DashboardLayout variant="owner" nav={OWNER_NAV} user={user!} />
    </RequireRole>
  )
}

function AdminShell() {
  const { user } = useSession()
  const pending = usePendingApplicationsCount()
  const moderation = useModerationCount()
  const reports = useOpenReportsCount()
  return (
    <DashboardLayout
      variant="admin"
      nav={ADMIN_NAV}
      user={user!}
      badges={{ '/admin/solicitudes': pending.data || undefined, '/admin/moderacion': moderation.data || undefined, '/admin/reportes': reports.data || undefined }}
    />
  )
}

export function AdminArea() {
  return (
    <RequireRole roles={['admin']}>
      <AdminShell />
    </RequireRole>
  )
}
