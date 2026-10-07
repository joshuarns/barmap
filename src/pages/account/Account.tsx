import { useNavigate } from 'react-router-dom'
import { useSession } from '@/features/auth/session'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { AccountView } from './AccountView'

export default function Account() {
  const { user } = useSession()
  const navigate = useNavigate()
  useDocumentMeta({ title: 'Mi cuenta' })
  if (!user) return null
  return (
    <div className="container-page py-10 md:py-14">
      <h1 className="mb-8 text-[32px] font-bold md:text-[40px]">Mi cuenta</h1>
      <AccountView user={user} onLoggedOut={() => navigate('/', { replace: true })} />
    </div>
  )
}
