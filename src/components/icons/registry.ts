import {
  Accessibility, Beer, Building2, CalendarCheck, Car, Cigarette, CreditCard, Dog, Flame, KeyRound, Martini, MicVocal,
  Music, Sparkles, Sun, Trophy, Utensils, Wifi, Wine, type LucideIcon,
} from 'lucide-react'

/**
 * Los catálogos guardan el nombre del icono (kebab-case de Lucide). Aquí se
 * resuelve a componente; los nombres desconocidos caen en un icono neutro.
 */
const ICONS: Record<string, LucideIcon> = {
  martini: Martini,
  flame: Flame,
  beer: Beer,
  'building-2': Building2,
  wine: Wine,
  'key-round': KeyRound,
  music: Music,
  'mic-vocal': MicVocal,
  trophy: Trophy,
  sun: Sun,
  wifi: Wifi,
  dog: Dog,
  car: Car,
  accessibility: Accessibility,
  'credit-card': CreditCard,
  'calendar-check': CalendarCheck,
  utensils: Utensils,
  cigarette: Cigarette,
  sparkles: Sparkles,
}

export function iconFor(name?: string | null): LucideIcon {
  return (name && ICONS[name]) || Sparkles
}

/** Iconos disponibles para catálogos (selector del admin). */
export const ICON_NAMES = Object.keys(ICONS)
