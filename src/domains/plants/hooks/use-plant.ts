import { useSQLiteContext } from "expo-sqlite";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getPlantById } from "../lib/db/plants.repository";
import { PLANTS_QUERY_KEY } from "./use-plants";

// Cuelga de `["plants"]` como el resto: el `invalidateQueries` que dispara una
// descarga refresca también esta pantalla, sin cablear nada extra.
export const PLANT_QUERY_KEY = [...PLANTS_QUERY_KEY, "plant"];

/**
 * Una plantación suelta, para las pantallas que cuelgan de ella y no de un
 * tratamiento — hoy, post-cosecha.
 *
 * `useTratamiento` ya traía la plantación, pero llegando por su tratamiento.
 * Post-cosecha no tiene tratamiento de por medio: sus cuatro variantes salen de
 * `EVALS_POST_COSECHA`, que es catálogo fijo del negocio y no vive en SQLite.
 *
 * `keepPreviousData` por lo mismo que allí: al saltar entre variantes la clave
 * no cambia —la plantación es la misma—, pero sí lo hará el día que se salte
 * entre plantaciones, y que la cabecera se desarme bajo el dedo es peor que
 * esperar un frame.
 */
export function usePlant(plantId: string) {
  const db = useSQLiteContext();

  return useQuery({
    queryKey: [...PLANT_QUERY_KEY, plantId],
    enabled: !!plantId,
    placeholderData: keepPreviousData,
    queryFn: () => getPlantById(db, plantId),
  });
}
