import { useEffect } from 'react'

interface Meta {
  title: string
  description?: string
  image?: string | null
  /** Datos estructurados schema.org (JSON-LD). */
  jsonLd?: object
}

function setMeta(attr: 'name' | 'property', key: string, content?: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!content) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

/**
 * Título, descripción, Open Graph y JSON-LD por página. En la Etapa 7 se
 * complementa con prerender en servidor para bots que no ejecutan JS.
 */
export function useDocumentMeta({ title, description, image, jsonLd }: Meta) {
  useEffect(() => {
    const full = title.includes('Barmap') ? title : `${title} · Barmap`
    document.title = full
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', full)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:image', image)
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:url', window.location.href)
    setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary')

    let script: HTMLScriptElement | null = null
    if (jsonLd) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }
    return () => script?.remove()
  }, [title, description, image, jsonLd])
}
