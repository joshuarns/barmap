import { BarChart3, HelpCircle, Home, PlusCircle, Store, UserRound } from 'lucide-react'
import type { DashboardNavItem } from '@/components/layout/DashboardLayout'

export const OWNER_NAV: DashboardNavItem[] = [
  { to: '/panel', label: 'Inicio', icon: Home, end: true },
  { to: '/panel/establecimientos', label: 'Mis establecimientos', icon: Store, end: true },
  { to: '/panel/establecimientos/nuevo', label: 'Agregar establecimiento', icon: PlusCircle },
  { to: '/panel/estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { to: '/panel/cuenta', label: 'Mi cuenta', icon: UserRound },
  { to: '/panel/ayuda', label: 'Ayuda', icon: HelpCircle },
]
