import { useSQLiteContext } from "expo-sqlite";
import { useQuery } from "@tanstack/react-query";
import { getTratamientoById } from "../lib/db/tratamientos.repository";
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
    queryFn: async () => {
      const tratamiento = await getTratamientoById(db, id);
      if (!tratamiento) return null;

      const plant = await getPlantById(db, tratamiento.plantId);
      return plant ? { tratamiento, plant } : null;
    },
  });
}
