import type { BarSummary } from '@/types/api'

/**
 * DATOS DE EJEMPLO — solo para la guía del sistema de diseño.
 * No se usan en flujos reales; a partir de la Etapa 2 los bares vienen de la API.
 */
const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=70`

export const SAMPLE_BARS: BarSummary[] = [
  {
    id: 's1', slug: 'la-azotea-roma', name: 'La Azotea', category: 'Rooftop', neighborhood: 'Roma Norte', city: 'CDMX',
    priceRange: 3, coverUrl: img('1514933651103-005eec06c04b'),
    imageUrls: [img('1514933651103-005eec06c04b'), img('1470337458703-46ad1756a187'), img('1551024709-8f23befc6f87')],
    distanceMeters: 650, isOpenNow: true, closesAt: '02:00',
  },
  {
    id: 's2', slug: 'mezcaleria-el-tigre', name: 'Mezcalería El Tigre', category: 'Mezcalería', neighborhood: 'Condesa', city: 'CDMX',
    priceRange: 2, coverUrl: img('1572116469696-31de0f17cc34'),
    imageUrls: [img('1572116469696-31de0f17cc34'), img('1543007630-9710e4a00a20')],
    distanceMeters: 1200, isOpenNow: true, closesAt: '01:00',
  },
  {
    id: 's3', slug: 'lupulo-norte', name: 'Lúpulo Norte', category: 'Cervecería', neighborhood: 'Juárez', city: 'CDMX',
    priceRange: 1, coverUrl: img('1566417713940-fe7c737a9ef2'), distanceMeters: 2300, isOpenNow: false,
  },
  {
    id: 's4', slug: 'salon-verde', name: 'Salón Verde', category: 'Coctelería', neighborhood: 'Polanco', city: 'CDMX',
    priceRange: 4, coverUrl: img('1575444758702-4a6b9222336e'),
    imageUrls: [img('1575444758702-4a6b9222336e'), img('1536935338788-846bb9981813')],
    distanceMeters: 4800, isOpenNow: true, closesAt: '03:00',
  },
]

