/** Primer elemento enfocable: salta la navegación (teclado y lectores de pantalla). */
export function SkipLink() {
  return (
    <a
      href="#contenido"
      className="sr-only z-[100] rounded-full bg-ink-900 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      Saltar al contenido
    </a>
  )
}
