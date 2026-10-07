import type { ApplicationStatus, PublicationStatus, AccountStatus } from '@/types/domain'
import { Badge, type BadgeProps } from './Badge'

type Tone = NonNullable<BadgeProps['tone']>

export const PUBLICATION_STATUS_META: Record<PublicationStatus, { label: string; tone: Tone; description: string }> = {
  draft: { label: 'Borrador', tone: 'neutral', description: 'Solo tú puedes verlo.' },
  pending_review: { label: 'En revisión', tone: 'info', description: 'Nuestro equipo lo está revisando.' },
  published: { label: 'Publicado', tone: 'success', description: 'Visible para todo el público.' },
  changes_requested: { label: 'Requiere cambios', tone: 'warning', description: 'Corrige lo indicado y vuelve a enviarlo.' },
  rejected: { label: 'Rechazado', tone: 'danger', description: 'La publicación no fue aprobada.' },
  suspended: { label: 'Suspendido', tone: 'dark', description: 'Retirado temporalmente del público.' },
}

export const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pendiente', tone: 'warning' },
  approved: { label: 'Aprobada', tone: 'success' },
  rejected: { label: 'Rechazada', tone: 'danger' },
}

export const ACCOUNT_STATUS_META: Record<AccountStatus, { label: string; tone: Tone }> = {
  active: { label: 'Activa', tone: 'success' },
  suspended: { label: 'Suspendida', tone: 'dark' },
}

export function PublicationStatusBadge({ status, size }: { status: PublicationStatus; size?: BadgeProps['size'] }) {
  const meta = PUBLICATION_STATUS_META[status]
  return (
    <Badge tone={meta.tone} size={size} dot>
      {meta.label}
    </Badge>
  )
}

export function ApplicationStatusBadge({ status, size }: { status: ApplicationStatus; size?: BadgeProps['size'] }) {
  const meta = APPLICATION_STATUS_META[status]
  return (
    <Badge tone={meta.tone} size={size} dot>
      {meta.label}
    </Badge>
  )
}

export function AccountStatusBadge({ status, size }: { status: AccountStatus; size?: BadgeProps['size'] }) {
  const meta = ACCOUNT_STATUS_META[status]
  return (
    <Badge tone={meta.tone} size={size} dot>
      {meta.label}
    </Badge>
  )
}
