import type { PhotoCategory } from "../types";

/**
 * Catálogo fijo del negocio: la evidencia fotográfica de un tratamiento son
 * estas tres tomas, y el evaluador adjunta las que haga falta de cada una.
 *
 * El `id` es además la clave con la que se guardan sus fotos —en el store hoy,
 * en `respuestas` cuando exista—, así que cambiarlo no es un cambio de texto.
 */
export const PHOTO_CATEGORIES: PhotoCategory[] = [
  { id: "racimo", label: "Racimo" },
  { id: "corte-vertical", label: "Corte vertical" },
  { id: "corte-horizontal", label: "Corte horizontal" },
];

/**
 * La categoría de un `id`, o `undefined` si no es ninguna.
 *
 * La necesita la cuadrícula a pantalla completa, que recibe el `id` por
 * parámetros de ruta —texto suelto que puede no corresponder a nada.
 */
export function findPhotoCategory(id: string): PhotoCategory | undefined {
  return PHOTO_CATEGORIES.find((category) => category.id === id);
}

export type PhotosOverview = {
  /** Fotografías adjuntas, sumando las tres categorías. */
  total: number;
  /** Categorías con al menos una fotografía. */
  withPhotos: number;
};

/**
 * Lo que resume la cabecera de la sección.
 *
 * Recorre el catálogo en vez de las claves del store: así lo guardado bajo una
 * clave que ya no es de ninguna categoría no se cuela en la cuenta.
 */
export function summarizePhotoCategories(
  photos: Record<string, string[]>,
): PhotosOverview {
  const counts = PHOTO_CATEGORIES.map(
    (category) => photos[category.id]?.length ?? 0,
  );

  return {
    total: counts.reduce((sum, count) => sum + count, 0),
    withPhotos: counts.filter((count) => count > 0).length,
  };
}
