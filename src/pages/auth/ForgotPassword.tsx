import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import { AuthCard } from '@/components/layout/AuthLayout'
import { isEmail } from '@/components/auth/fields'
import { Alert, Button, EmptyState, Field, Input } from '@/components/ui'
import { apiPost } from '@/lib/api'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const forgot = useMutation({ mutationFn: () => apiPost('/auth/forgot-password', { email: email.trim() }) })
  useDocumentMeta({ title: 'Recuperar contraseña' })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (isEmail(email)) forgot.mutate()
  }

  return (
    <AuthCard
      title="Recupera tu contraseña"
      subtitle={forgot.isSuccess ? undefined : 'Te enviaremos un enlace para crear una nueva.'}
      footer={<Link to="/entrar" className="font-semibold text-fg underline underline-offset-4">Volver a iniciar sesión</Link>}
    >
      {forgot.isSuccess ? (
        <EmptyState
          icon={MailCheck}
          className="py-2"
          title="Revisa tu correo"
          description={`Si ${email.trim()} tiene una cuenta en Barmap, recibirás un enlace válido por 1 hora.`}
        />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          {forgot.isError && <Alert tone="danger" title={forgot.error.message} />}
          <Field label="Correo electrónico" error={touched && !isEmail(email) ? 'Escribe un correo válido' : undefined}>
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Button type="submit" size="lg" block loading={forgot.isPending}>Enviar enlace</Button>
        </form>
      )}
    </AuthCard>
  )
}
