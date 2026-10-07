import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Eye } from 'lucide-react'
import { ErrorState } from '@/components/ErrorState'
import { Card, Skeleton } from '@/components/ui'
import { useCatalog } from '@/features/bars/queries'
import { useWorkingCopy } from '@/features/owner/bars'
import { BarView } from '@/pages/public/BarDetail'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import type { BarDetail } from '@/types/api'

/** Vista previa de la página pública con la copia de trabajo (incluye cambios no publicados). */
export default function BarPreview() {
  const { id = '' } = useParams()
  const wc = useWorkingCopy(id)
  const catalog = useCatalog()
  useDocumentMeta({ title: 'Vista previa' })

  if (wc.isError) return <Card><ErrorState error={wc.error} onRetry={() => wc.refetch()} /></Card>
  if (!wc.data || !catalog.data) return <Skeleton className="h-[600px] rounded-3xl" />

  const d = wc.data.data
  const cat = catalog.data.categories.find((c) => c.id === d.categoryId)
  const bar: BarDetail = {
    id, slug: wc.data.bar.slug, name: d.name || 'Tu bar', description: d.description || null,
    category: cat?.name ?? null, categorySlug: cat?.slug ?? null, categoryIcon: cat?.icon ?? null,
    type: catalog.data.types.find((t) => t.id === d.typeId)?.name ?? null,
    priceRange: d.priceRange ?? 2, address: d.address, neighborhood: d.neighborhood || null, city: d.city, state: d.state || null,
    country: d.country, postalCode: d.postalCode || null,
    latitude: d.latitude ?? 19.4326, longitude: d.longitude ?? -99.1332, timezone: 'America/Mexico_City',
    phone: d.phone || null, website: d.website ? (/^https?:/.test(d.website) ? d.website : `https://${d.website}`) : null,
    socialLinks: Object.fromEntries(Object.entries(d.social).filter(([, v]) => /^https:\/\//.test(v))),
    isOpenNow: undefined, isFeatured: false, isVerified: false, publishedAt: '', updatedAt: wc.data.bar.updatedAt,
    images: wc.data.images.map((i, k) => ({ url: i.url, width: null, height: null, isCover: k === 0 })),
    hours: d.hours.map((h) => ({ dayOfWeek: h.dayOfWeek, opens: h.opens, closes: h.closes, isClosed: h.isClosed })),
    amenities: catalog.data.amenities.filter((a) => d.amenityIds.includes(a.id)),
    nearby: [],
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink-900 px-5 py-3 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold"><Eye className="size-4" /> Vista previa · así verá la gente tu página{wc.data.revision ? ' con tus cambios' : ''}</p>
        <Link to={`/panel/establecimientos/${id}?paso=5`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-300 hover:underline">
          <ChevronLeft className="size-4" /> Volver a editar
        </Link>
      </div>
      <BarView bar={bar} preview />
    </>
  )
}
