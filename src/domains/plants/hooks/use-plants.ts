import { useSQLiteContext } from "expo-sqlite";
import { useQuery } from "@tanstack/react-query";
import { getAllPlants } from "../lib/db/plants.repository";
import { getTratamientoIdsWithErrors } from "../lib/db/respuestas.repository";

export const PLANTS_QUERY_KEY = ["plants"] as const;

/**
 * Las plantaciones del listado, con los tratamientos cuya captura trae un dato
 * imposible.
 *
 * La marca está guardada, no calculada aquí: la pone `saveRespuesta` al escribir
 * la sección, y esta consulta solo la lee. Antes se resolvía abriendo los
 * payloads al leer, lo cual crecía con los datos —8 000 filas eran 40 ms de
 * bloqueo del hilo de JS al entrar al listado—; ahora es un `SELECT` que no
 * parsea nada.
 *
 * Los ids y no un booleano por plantación: la tarjeta marca **cuál** de sus
 * chips hay que revisar, y de ahí sale si la plantación entera está marcada.
 */
export function usePlants() {
  const db = useSQLiteContext();

  return useQuery({
    queryKey: PLANTS_QUERY_KEY,
    queryFn: async () => {
      const [plants, withErrors] = await Promise.all([
        getAllPlants(db),
        getTratamientoIdsWithErrors(db),
      ]);

      return plants.map((plant) => ({
        ...plant,
        tratamientosWithError: plant.tratamientos
          .filter((tratamiento) => withErrors.has(tratamiento.id))
          .map((tratamiento) => tratamiento.id),
      }));
    },
  });
}
