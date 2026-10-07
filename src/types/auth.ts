import type { AccountStatus, ApplicationStatus, UserRole } from './domain'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  accountStatus: AccountStatus
  emailVerified: boolean
  application: {
    id: string
    status: ApplicationStatus
    businessName: string
    rejectionReason: string | null
    createdAt: string
    reviewedAt: string | null
  } | null
}
