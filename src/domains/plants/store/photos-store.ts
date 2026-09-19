import { create } from "zustand";

/**
 * Referencia estable para las secciones sin fotos.
 *
 * No es cosmética: zustand 5 compara lo que devuelve el selector con
 * `Object.is`, así que un `?? []` escrito dentro del selector crearía un array
 * nuevo en cada render y el componente se re-renderizaría en bucle.
 */
export const EMPTY_PHOTOS: string[] = [];

type PhotosStore = {
  /**
   * URIs por sección de la encuesta, del tratamiento que está abierto.
   *
   * La clave es solo la sección y no también el tratamiento porque esto se
   * vacía al cambiar de uno a otro, igual que las respuestas del formulario: lo
   * capturado pertenece a la evaluación en curso.
   */
  photos: Record<string, string[]>;
  addPhotos: (sectionId: string, uris: string[]) => void;
  /**
   * Por posición y no por URI: elegir dos veces la misma foto de la galería
   * repite URI, y borrar por URI se llevaría las dos.
   *
   * Recibe todas las posiciones de una vez y no una por llamada: cada borrado
   * desplaza los índices siguientes, así que encadenar llamadas acabaría
   * eliminando fotos que nadie eligió.
   */
  removePhotos: (sectionId: string, indices: number[]) => void;
  clearPhotos: () => void;
};

/**
 * Las fotografías capturadas, fuera de la pantalla porque ahora las leen dos:
 * la tarjeta de la sección y la cuadrícula a pantalla completa, que es otra
 * ruta y no podría ver un `useState`.
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
  photos: {},
  addPhotos: (sectionId, uris) =>
    set((state) => ({
      photos: {
        ...state.photos,
        [sectionId]: [...(state.photos[sectionId] ?? []), ...uris],
      },
    })),
  removePhotos: (sectionId, indices) => {
    const removed = new Set(indices);

    set((state) => ({
      photos: {
        ...state.photos,
        [sectionId]: (state.photos[sectionId] ?? []).filter(
          (_, index) => !removed.has(index),
        ),
      },
    }));
  },
  clearPhotos: () => set({ photos: {} }),
}));
