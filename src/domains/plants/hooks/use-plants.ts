import { useSQLiteContext } from "expo-sqlite";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/domains/auth/store/auth-store";
import { getAllPlants } from "../lib/db/plants.repository";
import { plantProgress } from "../lib/evaluation-progress";
import {
  getTratamientoIdsWithErrors,
  getTratamientoIdsWithPendingSync,
  getTratamientoProgress,
} from "../lib/db/respuestas.repository";
import {
  getPostcosechaEmpacadas,
  getPostcosechaIdsWithErrors,
  getPostcosechaIdsWithPendingSync,
  getPostcosechaProgress,
} from "../lib/db/postcosecha-respuestas.repository";
import { postcosechaKey } from "../lib/postcosecha-progress";
import { EVALS_POST_COSECHA } from "../lib/evals-post-cosecha";

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
  // Solo los campos del usuario: ver `getAllPlants`. La lista no entra en la
  // clave —la caché se vacía al cambiar de sesión, y los campos de un usuario
  // solo cambian al volver a iniciarla—.
  const campos = useAuthStore((s) => s.user?.campos);

  return useQuery({
    queryKey: PLANTS_QUERY_KEY,
    queryFn: async () => {
      const [
        plants,
        withErrors,
        progress,
        postcosecha,
        postcosechaErrors,
        empacadas,
        pendientes,
        postcosechaPendientes,
      ] = await Promise.all([
        getAllPlants(db, campos ?? []),
        getTratamientoIdsWithErrors(db),
        getTratamientoProgress(db),
        getPostcosechaProgress(db),
        getPostcosechaIdsWithErrors(db),
        getPostcosechaEmpacadas(db),
        getTratamientoIdsWithPendingSync(db),
        getPostcosechaIdsWithPendingSync(db),
      ]);

      return plants.map((plant) => {
        const tratamientos = plant.tratamientos.map((tratamiento) => ({
          ...tratamiento,
          progress: progress.get(tratamiento.id) ?? 0,
        }));

        const avancePostcosecha = Object.fromEntries(
          EVALS_POST_COSECHA.map((item) => [
            item.id,
            postcosecha.get(postcosechaKey(plant.id, item.id)) ?? 0,
          ]),
        );

        const pendientesDeEste = tratamientos
          .filter((tratamiento) => pendientes.has(tratamiento.id))
          .map((tratamiento) => tratamiento.id);
        const postcosechaPendientesDeEsta = EVALS_POST_COSECHA.filter((item) =>
          postcosechaPendientes.has(postcosechaKey(plant.id, item.id)),
        ).map((item) => item.id);

        return {
          ...plant,
          tratamientos,
          progress: plantProgress(
            tratamientos,
            Object.values(avancePostcosecha),
          ),
          tratamientosWithError: tratamientos
            .filter((tratamiento) => withErrors.has(tratamiento.id))
            .map((tratamiento) => tratamiento.id),
          // Las cuatro siempre, aunque el mapa no las traiga: el catálogo es
          // fijo y la tarjeta pinta las cuatro barras pase lo que pase. Por eso
          // mismo sirve tal cual como denominador del bloque de post-cosecha.
          postcosecha: avancePostcosecha,
          postcosechaWithError: EVALS_POST_COSECHA.filter((item) =>
            postcosechaErrors.has(postcosechaKey(plant.id, item.id)),
          ).map((item) => item.id),
          postcosechaEmpacada: EVALS_POST_COSECHA.filter((item) =>
            empacadas.has(postcosechaKey(plant.id, item.id)),
          ).map((item) => item.id),
          tratamientosPending: pendientesDeEste,
          postcosechaPending: postcosechaPendientesDeEsta,
          // Derivado de las dos listas y no de una consulta aparte: una
          // plantación tiene algo que mandar exactamente cuando lo tiene alguno
          // de sus chips. (Dejará de ser cierto el día que la poda conserve un
          // tratamiento inactivo con captura sin sincronizar — hoy los borra.)
          pendingSync:
            pendientesDeEste.length > 0 ||
            postcosechaPendientesDeEsta.length > 0,
        };
      });
    },
  });
}
