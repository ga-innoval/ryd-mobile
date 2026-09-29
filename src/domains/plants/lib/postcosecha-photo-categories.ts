import type { PhotoCategory } from "../types";

/**
 * Catálogo fijo del negocio: la evidencia fotográfica de una evaluación de
 * post-cosecha es una sola toma.
 *
 * Catálogo de uno y no una constante suelta, por lo mismo que en tratamientos:
 * el `id` es la clave con la que se guardan sus fotos, la cuadrícula a pantalla
 * completa lo recibe por parámetros de ruta, y así añadir una segunda toma es
 * una línea aquí y nada más.
 *
 * El `id` **no se renombra**: cambiarlo dejaría huérfano lo ya capturado.
 */
export const POSTCOSECHA_PHOTO_CATEGORIES: PhotoCategory[] = [
  { id: "racimos", label: "Racimos" },
];

/**
 * La categoría de un `id`, o `undefined` si no es ninguna. La necesita la
 * cuadrícula, que recibe el `id` como texto suelto desde la ruta.
 */
export function findPostcosechaPhotoCategory(
  id: string,
): PhotoCategory | undefined {
  return POSTCOSECHA_PHOTO_CATEGORIES.find((category) => category.id === id);
}
