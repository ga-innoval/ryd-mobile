import { create } from "zustand";

/**
 * Referencia estable para las categorías sin fotos.
 *
 * No es cosmética: zustand 5 compara lo que devuelve el selector con
 * `Object.is`, así que un `?? []` escrito dentro del selector crearía un array
 * nuevo en cada render y el componente se re-renderizaría en bucle.
 */
export const EMPTY_PHOTOS: string[] = [];

type PhotosStore = {
  /**
   * De qué tratamiento es lo que hay guardado.
   *
   * Sin esto, "vaciar al montar" y "vaciar al cambiar de tratamiento" son
   * indistinguibles: la pantalla no puede saber si se monta por primera vez o
   * por un remonte, y en el segundo caso se llevaría por delante lo ya
   * capturado. Con el dueño apuntado, la decisión la toma el store.
   */
  ownerId: string | null;
  /**
   * URIs por categoría de fotografía (`lib/photo-categories.ts`), del
   * tratamiento que está abierto.
   *
   * La clave es solo la categoría y no también el tratamiento porque esto se
   * vacía al cambiar de uno a otro, igual que las respuestas del formulario: lo
   * capturado pertenece a la evaluación en curso.
   */
  photos: Record<string, string[]>;
  addPhotos: (categoryId: string, uris: string[]) => void;
  /**
   * Por posición y no por URI: elegir dos veces la misma foto de la galería
   * repite URI, y borrar por URI se llevaría las dos.
   *
   * Recibe todas las posiciones de una vez y no una por llamada: cada borrado
   * desplaza los índices siguientes, así que encadenar llamadas acabaría
   * eliminando fotos que nadie eligió.
   */
  removePhotos: (categoryId: string, indices: number[]) => void;
  /**
   * Deja el store listo para ese tratamiento: lo vacía solo si lo que había
   * era de otro. Volver a reclamarlo para el mismo no toca nada, que es lo
   * que hace que un remonte no pierda fotos.
   */
  claimFor: (tratamientoId: string) => void;
};

/**
 * Las fotografías capturadas, fuera de la pantalla porque las leen dos: la
 * sección de fotografías y la cuadrícula a pantalla completa, que es otra ruta
 * y no podría ver un `useState`.
 *
 * **Sin `persist`, a propósito.** Persistir es una decisión aparte y aquí no
 * está tomada: falta decidir dónde acaban los archivos —lo más probable, una
 * carpeta de la app con `expo-file-system`— y el momento de escribirlos.
 *
 * TODO(respuestas): guardar al guardar la evaluación, no antes. Hasta entonces,
 * salir de la evaluación pierde lo capturado, y por eso está pendiente avisar
 * de cambios sin guardar al volver al listado.
 */
export const usePhotosStore = create<PhotosStore>()((set) => ({
  ownerId: null,
  photos: {},
  addPhotos: (categoryId, uris) =>
    set((state) => ({
      photos: {
        ...state.photos,
        [categoryId]: [...(state.photos[categoryId] ?? []), ...uris],
      },
    })),
  removePhotos: (categoryId, indices) => {
    const removed = new Set(indices);

    set((state) => ({
      photos: {
        ...state.photos,
        [categoryId]: (state.photos[categoryId] ?? []).filter(
          (_, index) => !removed.has(index),
        ),
      },
    }));
  },
  claimFor: (tratamientoId) =>
    set((state) =>
      state.ownerId === tratamientoId
        ? state
        : { ownerId: tratamientoId, photos: {} },
    ),
}));
