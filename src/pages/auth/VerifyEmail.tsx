import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, MailCheck, XCircle } from 'lucide-react'
import { AuthCard } from '@/components/layout/AuthLayout'
import { Button, EmptyState, Spinner, buttonVariants, useToast } from '@/components/ui'
import { sessionKey, useResendVerification, useSession } from '@/features/auth/session'
import { apiPost } from '@/lib/api'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'

/**
 * Dos modos:
 * - con ?token= → confirma el correo
 * - sin token   → "revisa tu bandeja" con opción de reenviar
 */
export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const next = params.get('next')
  useDocumentMeta({ title: 'Verificar correo' })
  return token ? <ConfirmToken token={token} /> : <CheckInbox next={next} />
}

function ConfirmToken({ token }: { token: string }) {
  const qc = useQueryClient()
  const { user } = useSession()
  const verify = useMutation({
    mutationFn: () => apiPost('/auth/verify-email', { token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKey }),
  })
  const started = useRef(false)
  useEffect(() => {
    // StrictMode monta dos veces: el token es de un solo uso.
    if (started.current) return
    started.current = true
    verify.mutate()
  }, [verify])

  const next = user?.role === 'visitor' ? '/registra-tu-bar' : user ? '/' : '/entrar'
  return (
    <AuthCard title="Verificación de correo">
      {verify.isPending || verify.isIdle ? (
        <div className="flex items-center gap-3 text-fg-muted"><Spinner /> Confirmando tu correo…</div>
      ) : verify.isSuccess ? (
        <EmptyState
          icon={CheckCircle2}
          title="¡Correo confirmado!"
          description="Tu cuenta ya está verificada."
          className="py-4"
          action={<Link to={next} className={buttonVariants()}>{user?.role === 'visitor' ? 'Continuar con mi solicitud' : 'Continuar'}</Link>}
        />
      ) : (
        <EmptyState
          icon={XCircle}
          tone="danger"
          title="No pudimos verificar tu correo"
          description={verify.error?.message}
          className="py-4"
          action={<Link to={user ? '/verificar-correo' : '/entrar'} className={buttonVariants({ variant: 'outline' })}>{user ? 'Solicitar un enlace nuevo' : 'Iniciar sesión'}</Link>}
        />
      )}
    </AuthCard>
  )
}

function CheckInbox({ next }: { next: string | null }) {
  const { user, refetch } = useSession()
  const resend = useResendVerification()
  const toast = useToast()

  if (user?.emailVerified) {
    return (
      <AuthCard title="Tu correo ya está verificado">
        <Link to={next ?? '/'} className={buttonVariants({ block: true, size: 'lg' })}>Continuar</Link>
      </AuthCard>
    )
  }
  return (
    <AuthCard title="Revisa tu correo">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><MailCheck className="size-7" /></span>
        <p className="mt-5 text-[15px] text-fg-muted">
          Enviamos un enlace de confirmación a <strong className="text-fg">{user?.email ?? 'tu correo'}</strong>. Ábrelo para activar tu cuenta.
        </p>
        <p className="mt-2 text-sm text-fg-subtle">¿No llegó? Revisa la carpeta de spam o solicita otro.</p>
        <div className="mt-6 flex w-full flex-col gap-3">
          {user && (
            <Button
              variant="outline"
              loading={resend.isPending}
              onClick={() =>
                resend.mutate(undefined, {
                  onSuccess: () => toast({ tone: 'success', title: 'Enlace enviado', description: 'Revisa tu bandeja de entrada.' }),
                  onError: (e) => toast({ tone: 'error', title: 'No se pudo enviar', description: e.message }),
                })
              }
            >
              Reenviar enlace
            </Button>
          )}
          <Button variant="ghost" onClick={() => refetch()}>Ya lo confirmé</Button>
          <Link to={next ?? '/'} className="text-sm font-semibold text-fg-muted hover:underline">Hacerlo después</Link>
        </div>
      </div>
    </AuthCard>
  )
}
