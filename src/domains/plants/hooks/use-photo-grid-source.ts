import { useMemo } from "react";
import type { PhotoCategory } from "../types";
import { EMPTY_FOTOS, useFotos, useRemoveFotos } from "./use-respuesta-fotos";
import {
  EMPTY_POSTCOSECHA_FOTOS,
  usePostcosechaFotos,
  useRemovePostcosechaFotos,
} from "./use-postcosecha-fotos";
import { findPhotoCategory } from "../lib/photo-categories";
import { findPostcosechaPhotoCategory } from "../lib/postcosecha-photo-categories";
import { groupFotosByCategoria } from "../lib/group-fotos-by-categoria";

/** Lo mínimo que la cuadrícula necesita de una fotografía. */
export type GridPhoto = { clientId: string; uri: string };

export type PhotoGridParams = {
  categoryId: string;
  /** Fotografías de un tratamiento. */
  tratamientoId?: string;
  /** Fotografías de post-cosecha: las dos van juntas o ninguna. */
  plantId?: string;
  evalId?: string;
};

/**
 * De dónde saca sus fotografías la cuadrícula a pantalla completa.
 *
 * Existe porque la misma pantalla sirve a las dos secciones de evidencia —la de
 * tratamiento y la de post-cosecha— y lo único que cambia entre ellas es la
 * tabla. Duplicar la pantalla habría significado duplicar la selección múltiple,
 * el visor y el borrado en lote para pintar exactamente lo mismo.
 *
 * **Los dos hooks se llaman siempre**, como exigen las reglas de hooks; cada uno
 * trae su `enabled`, así que el que no toca no consulta nada. Lo que decide es
 * qué parámetros trajo la ruta.
 */
export function usePhotoGridSource({
  categoryId,
  tratamientoId,
  plantId,
  evalId,
}: PhotoGridParams): {
  /** `undefined` si el `id` de la ruta no es de ninguna categoría. */
  category: PhotoCategory | undefined;
  photos: readonly GridPhoto[];
  isPending: boolean;
  removeFotos: (clientIds: string[]) => void;
} {
  const esPostcosecha = !!plantId && !!evalId;

  const tratamiento = useFotos(tratamientoId ?? "");
  const postcosecha = usePostcosechaFotos(plantId ?? "", evalId ?? "");

  const { mutate: removeTratamiento } = useRemoveFotos(tratamientoId ?? "");
  const { mutate: removePostcosecha } = useRemovePostcosechaFotos(
    plantId ?? "",
    evalId ?? "",
  );

  const photos = useMemo(() => {
    if (esPostcosecha) {
      const todas = postcosecha.data ?? EMPTY_POSTCOSECHA_FOTOS;
      return todas.filter((foto) => foto.categoria === categoryId);
    }

    return (
      groupFotosByCategoria(tratamiento.data ?? EMPTY_FOTOS)[categoryId] ??
      EMPTY_FOTOS
    );
  }, [esPostcosecha, postcosecha.data, tratamiento.data, categoryId]);

  return {
    category: esPostcosecha
      ? findPostcosechaPhotoCategory(categoryId)
      : findPhotoCategory(categoryId),
    photos,
    isPending: esPostcosecha ? postcosecha.isPending : tratamiento.isPending,
    removeFotos: esPostcosecha ? removePostcosecha : removeTratamiento,
  };
}
