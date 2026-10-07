import { Link } from 'react-router-dom'
import { Heart, Search } from 'lucide-react'
import { BarCard, BarCardSkeleton } from '@/components/bars/BarCard'
import { ErrorState } from '@/components/ErrorState'
import { EmptyState, buttonVariants } from '@/components/ui'
import { useSession } from '@/features/auth/session'
import { useFavoriteAction, useFavoritesList } from '@/features/engagement'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'

export default function Favorites() {
  const { user, isLoading } = useSession()
  const geo = useGeolocation()
  const list = useFavoritesList(geo.status === 'granted' ? geo.coords : undefined)
  const fav = useFavoriteAction()
  useDocumentMeta({ title: 'Mis favoritos' })

  return (
    <div className="container-page py-10 md:py-14">
      <h1 className="text-[32px] font-bold md:text-[40px]">Mis favoritos</h1>
      <p className="mt-1 text-[15px] text-fg-muted">Los bares que guardaste para visitar después.</p>

      <div className="mt-8">
        {isLoading ? null : !user ? (
          <EmptyState
            icon={Heart}
            title="Guarda tus bares favoritos"
            description="Inicia sesión para guardar lugares y tenerlos a mano en cualquier dispositivo."
            action={
              <>
                <Link to="/entrar?next=/favoritos" className={buttonVariants()}>Iniciar sesión</Link>
                <Link to="/registro?next=/favoritos" className={buttonVariants({ variant: 'outline' })}>Crear cuenta</Link>
              </>
            }
          />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.data ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <BarCardSkeleton key={i} />)}</div>
        ) : list.data.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Aún no guardas ningún bar"
            description="Toca el corazón en cualquier bar para guardarlo aquí."
            action={<Link to="/explorar" className={buttonVariants()}><Search /> Explorar bares</Link>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {list.data.map((b) => <BarCard key={b.id} bar={b} isFavorite={fav.isFavorite(b.id)} onToggleFavorite={fav.toggle} />)}
          </div>
        )}
      </div>
    </div>
  )
}
