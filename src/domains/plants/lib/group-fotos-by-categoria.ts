import { PHOTO_CATEGORIES } from "./photo-categories";

/**
 * Las fotografías de un tratamiento repartidas por toma.
 *
 * Recorre el catálogo y no las fotografías para que las tres tomas existan
 * siempre, también vacías: quien lo consume —la fila de la sección, el resumen
 * de la cabecera y el avance— pregunta por categoría, y un hueco ausente y uno
 * vacío tendrían que tratarse distinto sin motivo.
 *
 * Una fotografía de una categoría retirada del catálogo no aparece, igual que en
 * `summarizePhotoCategories`.
 */
export function groupFotosByCategoria<T extends { categoria: string }>(
  fotos: readonly T[],
): Record<string, T[]> {
  return Object.fromEntries(
    PHOTO_CATEGORIES.map((category) => [
      category.id,
      fotos.filter((foto) => foto.categoria === category.id),
    ]),
  );
}
