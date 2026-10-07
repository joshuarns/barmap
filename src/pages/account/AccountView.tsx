import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { KeyRound, LogOut, MailCheck, MailWarning } from 'lucide-react'
import { AccountStatusBadge, Alert, Avatar, Badge, Button, Card, CardBody, buttonVariants, useToast } from '@/components/ui'
import { useLogout, useResendVerification } from '@/features/auth/session'
import { apiPost } from '@/lib/api'
import type { SessionUser } from '@/types/auth'

const ROLE_LABEL = { visitor: 'Usuario', owner: 'Propietario', admin: 'Administrador' } as const

/** Datos de la cuenta, compartido por /cuenta (usuarios) y /panel/cuenta (propietarios). */
export function AccountView({ user, onLoggedOut }: { user: SessionUser; onLoggedOut: () => void }) {
  const toast = useToast()
  const logout = useLogout()
  const resend = useResendVerification()
  const reset = useMutation({ mutationFn: () => apiPost('/auth/forgot-password', { email: user.email }) })

  return (
    <div className="max-w-2xl space-y-6">
      {user.accountStatus === 'suspended' && (
        <Alert tone="danger" title="Tu cuenta está suspendida">Puedes consultar tu información, pero no realizar cambios. Contacta a soporte para más detalles.</Alert>
      )}
      <Card>
        <CardBody className="flex items-center gap-4">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0">
            <p className="text-lg font-bold">{user.name}</p>
            <p className="truncate text-fg-muted">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{ROLE_LABEL[user.role]}</Badge>
              <AccountStatusBadge status={user.accountStatus} />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            {user.emailVerified ? <MailCheck className="mt-0.5 size-5 shrink-0 text-success-600" /> : <MailWarning className="mt-0.5 size-5 shrink-0 text-warning-700" />}
            <div>
              <p className="font-semibold">{user.emailVerified ? 'Correo verificado' : 'Correo sin verificar'}</p>
              <p className="text-sm text-fg-muted">{user.emailVerified ? 'Tu correo está confirmado.' : 'Confírmalo para solicitar acceso de propietario.'}</p>
            </div>
          </div>
          {!user.emailVerified && (
            <Button
              variant="outline"
              size="sm"
              loading={resend.isPending}
              onClick={() => resend.mutate(undefined, {
                onSuccess: () => toast({ tone: 'success', title: 'Enlace enviado', description: 'Revisa tu bandeja de entrada.' }),
                onError: (e) => toast({ tone: 'error', title: 'No se pudo enviar', description: e.message }),
              })}
            >
              Reenviar enlace
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-fg-muted" />
            <div>
              <p className="font-semibold">Contraseña</p>
              <p className="text-sm text-fg-muted">Te enviaremos un enlace para crear una nueva.</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            loading={reset.isPending}
            onClick={() => reset.mutate(undefined, {
              onSuccess: () => toast({ tone: 'success', title: 'Enlace enviado', description: `Revisa ${user.email}.` }),
              onError: (e) => toast({ tone: 'error', title: 'No se pudo enviar', description: e.message }),
            })}
          >
            Cambiar contraseña
          </Button>
        </CardBody>
      </Card>

      {user.role === 'visitor' && (
        <Card className="bg-subtle">
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">¿Tienes un bar?</p>
              <p className="text-sm text-fg-muted">
                {user.application?.status === 'pending' ? 'Tu solicitud está en revisión.' : 'Solicita acceso para publicarlo en Barmap.'}
              </p>
            </div>
            <Link to="/registra-tu-bar" className={buttonVariants({ variant: 'dark', size: 'sm' })}>
              {user.application?.status === 'pending' ? 'Ver solicitud' : 'Registrar mi bar'}
            </Link>
          </CardBody>
        </Card>
      )}

      <Button variant="ghost" onClick={() => logout.mutate(undefined, { onSettled: onLoggedOut })} loading={logout.isPending}>
        <LogOut /> Cerrar sesión
      </Button>
    </div>
  )
}
