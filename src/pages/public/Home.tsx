import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, MapPin } from 'lucide-react'
import { HeroSearch } from '@/components/bars/HeroSearch'
import { CategoryRail } from '@/components/bars/CategoryRail'
import { BarRail } from '@/components/bars/BarRail'
import { LocationPrompt } from '@/components/bars/LocationPrompt'
import { Skeleton, buttonVariants } from '@/components/ui'
import { useBarSearch, useCatalog } from '@/features/bars/queries'
import { serializeFilters } from '@/features/bars/filters'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'

export default function Home() {
  const navigate = useNavigate()
  const geo = useGeolocation()
  const catalog = useCatalog()
  const coords = geo.status === 'granted' ? geo.coords : undefined

  useDocumentMeta({
    title: 'Barmap · Descubre bares cerca de ti',
    description: 'Encuentra bares, mezcalerías, cervecerías y rooftops cerca de ti. Horarios, fotos, ubicación y servicios de cada lugar.',
  })

  const nearby = useBarSearch({ lat: coords?.lat, lng: coords?.lng, radio: 10, orden: 'distance', pageSize: 8 }, { enabled: !!coords })
  const popular = useBarSearch({ orden: 'popular', pageSize: 8, lat: coords?.lat, lng: coords?.lng })
  const recommended = useBarSearch({ orden: 'recommended', pageSize: 8, lat: coords?.lat, lng: coords?.lng })

  const explore = (params: Parameters<typeof serializeFilters>[0]) => {
    const qs = serializeFilters(params).toString()
    navigate(`/explorar${qs ? `?${qs}` : ''}`)
  }

  return (
    <>
      <section className="relative bg-[radial-gradient(60rem_28rem_at_85%_-10%,var(--color-brand-50),transparent_70%),radial-gradient(40rem_24rem_at_0%_30%,var(--color-ink-50),transparent_70%)]">
        <div className="container-page relative pb-10 pt-10 md:pb-14 md:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="animate-fade-up text-[40px] font-extrabold leading-[1.02] tracking-[-0.035em] md:text-[64px]">
              ¿A dónde vamos <span className="text-brand-600">esta noche</span>?
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[17px] text-fg-muted md:text-lg">
              Descubre bares cerca de ti, explóralos en el mapa y encuentra tu próximo plan.
            </p>
            <HeroSearch
              className="mt-8 text-left md:mt-10"
              onSearch={({ q, where }) => explore({ q, donde: where })}
              onUseLocation={() => {
                geo.request()
                explore({ orden: 'distance' })
              }}
            />
          </div>
        </div>
      </section>

      <div className="container-page">
        <div className="border-b border-line">
          {catalog.data ? (
            <CategoryRail
              categories={catalog.data.categories.filter((c) => c.barCount > 0)}
              value=""
              onChange={(slug) => explore({ categoria: slug })}
            />
          ) : (
            <div className="flex gap-8 pb-3 pt-1" aria-hidden>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <Skeleton className="size-6 rounded-md" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))}
            </div>
          )}
        </div>

        {coords ? (
          <BarRail
            title="Cerca de ti"
            subtitle="A menos de 10 km de tu ubicación"
            bars={nearby.data?.items}
            isLoading={nearby.isLoading}
            isError={nearby.isError}
            onRetry={() => nearby.refetch()}
            seeAllHref={`/explorar?${serializeFilters({ orden: 'distance', radio: 10 })}`}
            empty={
              <div className="rounded-2xl bg-subtle p-6 text-[15px] text-fg-muted">
                Aún no hay bares publicados cerca de ti. Explora otras ciudades más abajo.
              </div>
            }
          />
        ) : (
          <div className="mt-10">
            <LocationPrompt state={geo.status} onRequest={geo.request} />
          </div>
        )}

        <BarRail
          title="Populares esta semana"
          subtitle="Los lugares que más se están visitando en Barmap"
          bars={popular.data?.items}
          isLoading={popular.isLoading}
          isError={popular.isError}
          onRetry={() => popular.refetch()}
          seeAllHref={`/explorar?${serializeFilters({ orden: 'popular' })}`}
        />

        <BarRail
          title="Recomendados"
          subtitle="Lugares destacados y verificados por nuestro equipo"
          bars={recommended.data?.items}
          isLoading={recommended.isLoading}
          isError={recommended.isError}
          onRetry={() => recommended.refetch()}
          seeAllHref={`/explorar?${serializeFilters({ orden: 'recommended' })}`}
        />

        {!!catalog.data?.cities.length && (
          <section className="mt-12 md:mt-16">
            <h2 className="mb-5 text-[24px] font-bold md:text-[28px]">Explora por ciudad</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {catalog.data.cities.map((c) => (
                <Link
                  key={c.name}
                  to={`/explorar?${serializeFilters({ donde: c.name })}`}
                  className="group flex items-center gap-3 rounded-2xl border border-line p-4 transition-[border-color,box-shadow] hover:border-ink-300 hover:shadow-sm"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <MapPin className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold leading-snug text-fg">{c.name}</span>
                    <span className="text-sm text-fg-muted">{c.barCount} {c.barCount === 1 ? 'bar' : 'bares'}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-16 overflow-hidden rounded-[2rem] bg-ink-900 text-white md:mt-24">
          <div className="grid items-center gap-8 p-8 md:grid-cols-[1.3fr_1fr] md:p-14">
            <div>
              <p className="text-sm font-semibold text-brand-300">Para negocios</p>
              <h2 className="mt-2 text-[30px] font-bold leading-tight md:text-[40px]">¿Tienes un bar? Haz que te encuentren.</h2>
              <p className="mt-3 max-w-lg text-[17px] text-ink-300">
                Publica tu establecimiento gratis, muestra fotos, horarios y servicios, y llega a personas que buscan a dónde ir esta noche.
              </p>
              <Link to="/registra-tu-bar" className={buttonVariants({ variant: 'primary', size: 'lg', className: 'mt-7' })}>
                Registra tu bar <ArrowRight />
              </Link>
            </div>
            <ul className="space-y-4 text-[15px]">
              {['Solicita tu cuenta de propietario', 'Completa la ficha en 5 pasos', 'Nuestro equipo la revisa y la publica'].map((t, i) => (
                <li key={t} className="flex items-center gap-4 rounded-2xl bg-white/5 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  )
}
