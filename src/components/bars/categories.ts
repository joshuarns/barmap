import { Beer, Building2, Flame, KeyRound, Martini, MicVocal, Music, Sparkles, Trophy, Wine, type LucideIcon } from 'lucide-react'

/**
 * Catálogo inicial de categorías. En producción vive en la tabla `categories`
 * (gestionable por el admin); este mapa solo resuelve el icono por slug.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  todos: Sparkles,
  cocteleria: Martini,
  mezcaleria: Flame,
  cerveceria: Beer,
  rooftop: Building2,
  'wine-bar': Wine,
  speakeasy: KeyRound,
  'musica-en-vivo': Music,
  karaoke: MicVocal,
  deportivo: Trophy,
}

export const SEED_CATEGORIES = [
  { slug: 'todos', name: 'Todos' },
  { slug: 'cocteleria', name: 'Coctelería' },
  { slug: 'mezcaleria', name: 'Mezcalerías' },
  { slug: 'cerveceria', name: 'Cervecerías' },
  { slug: 'rooftop', name: 'Rooftops' },
  { slug: 'wine-bar', name: 'Vinos' },
  { slug: 'speakeasy', name: 'Speakeasy' },
  { slug: 'musica-en-vivo', name: 'Música en vivo' },
  { slug: 'karaoke', name: 'Karaoke' },
  { slug: 'deportivo', name: 'Deportivos' },
]
