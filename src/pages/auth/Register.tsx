import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthCard } from '@/components/layout/AuthLayout'
import { Honeypot, PasswordHints, PasswordInput, isEmail, passwordValid } from '@/components/auth/fields'
import { Alert, Button, Checkbox, Field, Input } from '@/components/ui'
import { useRegister } from '@/features/auth/session'
import { ApiError, fieldError } from '@/lib/api'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'

export default function Register() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const register = useRegister()
  const next = params.get('next')
  const forOwner = next === '/registra-tu-bar'
  const [form, setForm] = useState({ name: '', email: '', password: '', acceptTerms: false, website_url: '' })
  const [touched, setTouched] = useState(false)
  useDocumentMeta({ title: 'Crear cuenta' })

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const errors = {
    name: form.name.trim().length < 2 ? 'Escribe tu nombre' : fieldError(register.error, 'name'),
    email: !isEmail(form.email) ? 'Escribe un correo válido' : fieldError(register.error, 'email'),
    password: !passwordValid(form.password) ? 'La contraseña no cumple los requisitos' : fieldError(register.error, 'password'),
    acceptTerms: !form.acceptTerms ? 'Debes aceptar los términos para continuar' : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)
  const show = (k: keyof typeof errors) => (touched ? errors[k] : fieldError(register.error, k))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!valid) return
    register.mutate(
      { ...form, name: form.name.trim(), email: form.email.trim() },
      { onSuccess: () => navigate(`/verificar-correo${next ? `?next=${encodeURIComponent(next)}` : ''}`, { replace: true }) },
    )
  }

  // Errores generales (red, límite de peticiones); los de campo se muestran en cada campo.
  const serverError = register.error && !(register.error instanceof ApiError && register.error.details)

  return (
    <AuthCard
      title={forOwner ? 'Crea tu cuenta de negocio' : 'Crea tu cuenta'}
      subtitle={forOwner ? 'Primero crea tu cuenta; después completarás la solicitud para publicar tu bar.' : 'Guarda tus bares favoritos y encuentra tu próximo plan.'}
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to={`/entrar${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-fg underline underline-offset-4">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="relative space-y-5">
        {serverError && <Alert tone="danger" title={register.error!.message} />}
        {register.error && fieldError(register.error, 'email') && (
          <Alert tone="warning" title="Este correo ya tiene una cuenta" action={<Link to="/entrar" className="text-sm font-semibold underline">Iniciar sesión</Link>} />
        )}
        <Field label="Nombre completo" error={show('name')}>
          <Input autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} autoFocus />
        </Field>
        <Field label="Correo electrónico" error={show('email')}>
          <Input type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={160} />
        </Field>
        <Field label="Contraseña" error={touched ? show('password') : undefined}>
          <PasswordInput autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} maxLength={72} />
        </Field>
        <PasswordHints value={form.password} />
        <div>
          <Checkbox
            checked={form.acceptTerms}
            onChange={(e) => set('acceptTerms', e.target.checked)}
            label={
              <>
                Acepto los <Link to="/legal/terminos" className="underline">términos</Link> y el{' '}
                <Link to="/legal/privacidad" className="underline">aviso de privacidad</Link>
              </>
            }
          />
          {show('acceptTerms') && <p className="mt-1.5 text-[13px] font-medium text-danger-600">{show('acceptTerms')}</p>}
        </div>
        <Honeypot value={form.website_url} onChange={(v) => set('website_url', v)} />
        <Button type="submit" size="lg" block loading={register.isPending}>
          Crear cuenta
        </Button>
      </form>
    </AuthCard>
  )
}
