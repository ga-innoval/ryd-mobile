/**
 * Minúsculas y sin diacríticos. Lo comparten la búsqueda y el orden a
 * propósito: buscar ignorando acentos pero ordenar respetándolos daría
 * resultados incoherentes entre sí.
 *
 * Ojo: la `ñ` se descompone en NFD y queda como `n`, así que ordena junto a
 * las palabras con `n` en vez de después, como haría el alfabeto español.
 */
export const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
