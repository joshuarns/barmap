import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { AuthCard } from '@/components/layout/AuthLayout'
import { PasswordHints, PasswordInput, passwordValid } from '@/components/auth/fields'
import { Alert, Button, EmptyState, Field, buttonVariants } from '@/components/ui'
import { sessionKey } from '@/features/auth/session'
import { apiPost } from '@/lib/api'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const qc = useQueryClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const reset = useMutation({
    mutationFn: () => apiPost('/auth/reset-password', { token, password }),
    // Todas las sesiones se cierran al cambiar la contraseña.
    onSuccess: () => qc.setQueryData(sessionKey, null),
  })
  useDocumentMeta({ title: 'Nueva contraseña' })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (passwordValid(password) && password === confirm) reset.mutate()
  }

  if (!token) {
    return (
      <AuthCard title="Enlace incompleto">
        <Alert tone="warning" title="Falta el código del enlace">Abre el enlace completo desde el correo o solicita uno nuevo.</Alert>
        <Link to="/olvide-contrasena" className={buttonVariants({ variant: 'outline', block: true, className: 'mt-5' })}>Solicitar enlace</Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Crea una nueva contraseña">
      {reset.isSuccess ? (
        <EmptyState
          icon={CheckCircle2}
          className="py-2"
          title="Contraseña actualizada"
          description="Cerramos todas tus sesiones por seguridad. Inicia sesión con tu nueva contraseña."
          action={<Link to="/entrar" className={buttonVariants()}>Iniciar sesión</Link>}
        />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          {reset.isError && (
            <Alert tone="danger" title={reset.error.message} action={<Link to="/olvide-contrasena" className="text-sm font-semibold underline">Solicitar otro enlace</Link>} />
          )}
          <Field label="Nueva contraseña" error={touched && !passwordValid(password) ? 'La contraseña no cumple los requisitos' : undefined}>
            <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus maxLength={72} />
          </Field>
          <PasswordHints value={password} />
          <Field label="Confirmar contraseña" error={touched && confirm !== password ? 'Las contraseñas no coinciden' : undefined}>
            <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} maxLength={72} />
          </Field>
          <Button type="submit" size="lg" block loading={reset.isPending}>Guardar contraseña</Button>
        </form>
      )}
    </AuthCard>
  )
}
