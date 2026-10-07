/** Acumula parámetros posicionales ($1, $2…) para construir SQL seguro. */
export class Params {
  values: unknown[] = []
  add(value: unknown) {
    this.values.push(value)
    return `$${this.values.length}`
  }
}

/** Escapa comodines de LIKE para que el texto del usuario sea literal. */
export function likeEscape(text: string) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}
