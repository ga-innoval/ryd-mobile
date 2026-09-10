import { useSQLiteContext } from "expo-sqlite";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getTratamientoById,
  getTratamientosByPlantId,
} from "../lib/db/tratamientos.repository";
import { getPlantById } from "../lib/db/plants.repository";
import { PLANTS_QUERY_KEY } from "./use-plants";

// El prefijo `["plants"]` no es decorativo: hace que el `invalidateQueries`
// que ya dispara `usePlantsMutation` al terminar una descarga refresque
// también esta pantalla, sin cablear nada extra.
export const TRATAMIENTO_QUERY_KEY = [...PLANTS_QUERY_KEY, "tratamiento"];

/**
 * Compone aquí y no en el repositorio a propósito: `plants.repository`
 * ya importa de `tratamientos.repository`, así que hacerlo al revés cerraría
 * un ciclo de imports. Cada repositorio se queda con su tabla.
 */
export function useTratamiento(id: string) {
  const db = useSQLiteContext();

  return useQuery({
    queryKey: [...TRATAMIENTO_QUERY_KEY, id],
    // Al saltar a un hermano cambia la key y su entrada está vacía. Sin esto,
    // el header y la propia barra mostrarían sus skeletons durante el salto —
    // que se desarme la barra bajo el dedo es peor que la animación que
    // acabamos de quitar. En la primera carga no hay dato previo, así que el
    // skeleton sigue apareciendo donde debe.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const tratamiento = await getTratamientoById(db, id);
      if (!tratamiento) return null;

      const plant = await getPlantById(db, tratamiento.plantId);
      if (!plant) return null;

      // Los hermanos alimentan la barra de acceso rápido. Se traen en la misma
      // query para que la pantalla tenga un solo estado de carga que coordinar.
      const tratamientos = await getTratamientosByPlantId(db, plant.id);

      return { tratamiento, plant, tratamientos };
    },
  });
}
