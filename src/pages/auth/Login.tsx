import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthCard } from '@/components/layout/AuthLayout'
import { PasswordInput, isEmail } from '@/components/auth/fields'
import { Alert, Button, Field, Input } from '@/components/ui'
import { homeFor, useLogin } from '@/features/auth/session'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'

export default function Login() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  useDocumentMeta({ title: 'Iniciar sesión' })

  const emailError = touched && !isEmail(email) ? 'Escribe un correo válido' : undefined
  const passwordError = touched && !password ? 'Escribe tu contraseña' : undefined
  const next = params.get('next')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!isEmail(email) || !password) return
    login.mutate({ email: email.trim(), password }, { onSuccess: ({ user }) => navigate(homeFor(user, next), { replace: true }) })
  }

  return (
    <AuthCard
      title="Bienvenido de vuelta"
      subtitle="Inicia sesión para guardar bares o gestionar tu establecimiento."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to={`/registro${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-fg underline underline-offset-4">
            Crear cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {login.isError && <Alert tone="danger" title={login.error.message} />}
        <Field label="Correo electrónico" error={emailError}>
          <Input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field
          label="Contraseña"
          error={passwordError}
          aside={<Link to="/olvide-contrasena" className="text-sm font-semibold text-fg-muted hover:text-fg hover:underline">¿La olvidaste?</Link>}
        >
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" block loading={login.isPending}>
          Iniciar sesión
        </Button>
      </form>
    </AuthCard>
  )
}
