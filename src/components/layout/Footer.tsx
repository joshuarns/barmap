import { Link } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'

const columns = [
  { title: 'Descubre', links: [{ to: '/explorar', label: 'Explorar bares' }, { to: '/explorar?vista=mapa', label: 'Mapa' }, { to: '/favoritos', label: 'Mis favoritos' }] },
  { title: 'Negocios', links: [{ to: '/registra-tu-bar', label: 'Registra tu bar' }, { to: '/entrar', label: 'Panel de propietarios' }, { to: '/ayuda', label: 'Guía de publicación' }] },
  { title: 'Barmap', links: [{ to: '/ayuda', label: 'Centro de ayuda' }, { to: '/legal/terminos', label: 'Términos' }, { to: '/legal/privacidad', label: 'Privacidad' }] },
]

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-subtle pb-24 md:pb-0">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-[15px] text-fg-muted">Encuentra tu próximo bar favorito. Lugares revisados por personas, publicados por sus dueños.</p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="font-sans text-sm font-bold tracking-normal text-fg">{col.title}</h4>
            <ul className="mt-4 space-y-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-[15px] text-fg-muted transition-colors hover:text-fg hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-6 text-sm text-fg-muted md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} Barmap. Bebe con responsabilidad.</p>
          <p>Hecho para descubrir la noche.</p>
        </div>
      </div>
    </footer>
  )
}
