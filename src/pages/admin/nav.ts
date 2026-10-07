import { ClipboardCheck, Flag, History, LayoutDashboard, Store, Tags, UserCheck, Users } from 'lucide-react'
import type { DashboardNavItem } from '@/components/layout/DashboardLayout'

export const ADMIN_NAV: DashboardNavItem[] = [
  { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/admin/solicitudes', label: 'Solicitudes', icon: UserCheck },
  { to: '/admin/moderacion', label: 'Moderación', icon: ClipboardCheck },
  { to: '/admin/establecimientos', label: 'Establecimientos', icon: Store },
  { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { to: '/admin/catalogos', label: 'Categorías y servicios', icon: Tags },
  { to: '/admin/reportes', label: 'Reportes', icon: Flag },
  { to: '/admin/historial', label: 'Historial', icon: History },
]
