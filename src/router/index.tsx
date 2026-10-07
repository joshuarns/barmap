import { lazy, type ComponentType } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { RedirectIfAuthenticated, RequireAuth } from '@/components/auth/guards'
import { AdminArea, OwnerArea } from './areas'
import Home from '@/pages/public/Home'
import Explore from '@/pages/public/Explore'
import BarDetail from '@/pages/public/BarDetail'
import NotFound from '@/pages/NotFound'
import RouteError from '@/pages/RouteError'

// Carga diferida por área: el visitante solo descarga el sitio público.
const named = <T, K extends keyof T>(p: Promise<T>, k: K) => p.then((m) => ({ default: m[k] as ComponentType }))
const OwnerSignup = lazy(() => import('@/pages/public/OwnerSignup'))
const Favorites = lazy(() => import('@/pages/public/Favorites'))
const Help = lazy(() => import('@/pages/public/Help'))
const Legal = lazy(() => import('@/pages/public/Legal'))
const Login = lazy(() => import('@/pages/auth/Login'))
const Register = lazy(() => import('@/pages/auth/Register'))
const VerifyEmail = lazy(() => import('@/pages/auth/VerifyEmail'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const Account = lazy(() => import('@/pages/account/Account'))
const OwnerHome = lazy(() => import('@/pages/owner/OwnerHome'))
const OwnerAccount = lazy(() => named(import('@/pages/owner/OwnerHome'), 'OwnerAccount'))
const MyBars = lazy(() => import('@/pages/owner/MyBars'))
const BarEditor = lazy(() => import('@/pages/owner/BarEditor'))
const NewBar = lazy(() => named(import('@/pages/owner/BarEditor'), 'NewBar'))
const BarPreview = lazy(() => import('@/pages/owner/BarPreview'))
const Stats = lazy(() => import('@/pages/owner/Stats'))
const Applications = lazy(() => import('@/pages/admin/Applications'))
const ApplicationDetail = lazy(() => import('@/pages/admin/ApplicationDetail'))
const AdminOverview = lazy(() => import('@/pages/admin/Overview'))
const Moderation = lazy(() => import('@/pages/admin/Moderation'))
const ModerationReview = lazy(() => import('@/pages/admin/ModerationReview'))
const AdminBars = lazy(() => import('@/pages/admin/Bars'))
const BarAdminEdit = lazy(() => import('@/pages/admin/BarAdminEdit'))
const AdminUsers = lazy(() => import('@/pages/admin/Users'))
const AdminUserDetail = lazy(() => import('@/pages/admin/UserDetail'))
const Catalogs = lazy(() => import('@/pages/admin/Catalogs'))
const AdminHistory = lazy(() => import('@/pages/admin/History'))
const AdminReports = lazy(() => import('@/pages/admin/Reports'))

// La guía del sistema de diseño es interna: se carga aparte.
const DesignSystem = lazy(() => import('@/pages/design/DesignSystem'))

/**
 * Mapa de rutas de Barmap. Las guardas (RequireAuth/RequireRole) solo
 * ajustan la UI: el servidor valida sesión, rol y estado en cada endpoint.
 */
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/design', element: <DesignSystem /> },
      { path: '/explorar', element: <Explore /> },
      { path: '/bares/:slug', element: <BarDetail />, handle: { hideTabBar: true } },
      { path: '/registra-tu-bar', element: <OwnerSignup /> },
      { path: '/cuenta', element: <RequireAuth><Account /></RequireAuth> },
      { path: '/favoritos', element: <Favorites /> },
      { path: '/ayuda', element: <Help /> },
      { path: '/legal/:doc', element: <Legal /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/entrar', element: <RedirectIfAuthenticated to="/"><Login /></RedirectIfAuthenticated> },
      { path: '/registro', element: <RedirectIfAuthenticated to="/"><Register /></RedirectIfAuthenticated> },
      { path: '/verificar-correo', element: <VerifyEmail /> },
      { path: '/olvide-contrasena', element: <ForgotPassword /> },
      { path: '/restablecer-contrasena', element: <ResetPassword /> },
    ],
  },
  {
    path: '/panel',
    element: <OwnerArea />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <OwnerHome /> },
      { path: 'establecimientos', element: <MyBars /> },
      { path: 'establecimientos/nuevo', element: <NewBar /> },
      { path: 'establecimientos/:id', element: <BarEditor /> },
      { path: 'establecimientos/:id/vista-previa', element: <BarPreview /> },
      { path: 'estadisticas', element: <Stats /> },
      { path: 'cuenta', element: <OwnerAccount /> },
      { path: 'ayuda', element: <><PageHeader title="Ayuda" /><Help embedded ownersFirst /></> },
    ],
  },
  {
    path: '/admin',
    element: <AdminArea />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <AdminOverview /> },
      { path: 'solicitudes', element: <Applications /> },
      { path: 'solicitudes/:id', element: <ApplicationDetail /> },
      { path: 'moderacion', element: <Moderation /> },
      { path: 'moderacion/:id', element: <ModerationReview /> },
      { path: 'establecimientos', element: <AdminBars /> },
      { path: 'establecimientos/:id/editar', element: <BarAdminEdit /> },
      { path: 'usuarios', element: <AdminUsers /> },
      { path: 'usuarios/:id', element: <AdminUserDetail /> },
      { path: 'catalogos', element: <Catalogs /> },
      { path: 'reportes', element: <AdminReports /> },
      { path: 'historial', element: <AdminHistory /> },
    ],
  },
])
