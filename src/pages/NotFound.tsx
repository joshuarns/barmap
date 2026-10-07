import { Link } from 'react-router-dom'
import { MapPinOff } from 'lucide-react'
import { EmptyState, buttonVariants } from '@/components/ui'

export default function NotFound() {
  return (
    <div className="container-page py-20">
      <EmptyState
        icon={MapPinOff}
        title="Esta página no está en el mapa"
        description="Puede que el enlace sea antiguo o que el lugar ya no exista."
        action={<Link to="/" className={buttonVariants({ variant: 'primary' })}>Volver al inicio</Link>}
      />
    </div>
  )
}
