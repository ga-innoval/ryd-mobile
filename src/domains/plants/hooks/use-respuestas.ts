import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import {
  deleteRespuestasByTratamiento,
  getRespuestasByTratamiento,
  saveRespuesta,
} from "../lib/db/respuestas.repository";
import type {
  EvaluationFormValues,
  EvaluationSectionId,
} from "../lib/evaluation-schema";
import { PLANTS_QUERY_KEY } from "./use-plants";

// Cuelga de `["plants"]` como el resto: así la invalidación que dispara una
// descarga alcanza también a lo capturado.
export const RESPUESTAS_QUERY_KEY = [...PLANTS_QUERY_KEY, "respuestas"];

/**
 * Lo guardado de un tratamiento, para volcarlo al formulario al abrirlo.
 *
 * **Su caché no sobrevive a la pantalla (`gcTime: 0`), y eso es el invariante.**
 * Esta consulta no se invalida nunca —ver `useSaveRespuestas`—, así que al
 * reabrir el tratamiento `useQuery` entregaba lo cacheado en el primer render,
 * el volcado corría justo después y `loadedFor` lo dejaba clavado ahí: se veía
 * el formulario como estaba **antes** de lo último guardado, y no se corregía
 * hasta la visita siguiente. Con `staleTime` de un minuto ni siquiera se releía.
 *
 * Sin caché que heredar, `data` llega `undefined` al montar, el volcado no
 * engancha nada y espera al dato real — que es justo lo que ya hacía bien la
 * primera vez que se abría un tratamiento.
 *
 * No contradice al `loadedFor` de la pantalla, lo completa: el volcado sigue
 * siendo de una sola vez para que un refetch no pise lo que se está tecleando.
 * `staleTime: 0` no bastaba —el primer render seguiría entregando lo cacheado—,
 * y rellenar la caché a mano al guardar obligaba a construir las filas en dos
 * sitios. Releer es un `SELECT` local por tratamiento.
 */
export function useRespuestas(tratamientoId: string) {
  const db = useSQLiteContext();

  return useQuery(respuestasQueryOptions(db, tratamientoId));
}

/**
 * Las opciones del hook, aparte para que el test monte un observador con las
 * mismas: copiarlas en el test dejaría que quitar el `gcTime` pasara en verde.
 */
export function respuestasQueryOptions(
  db: SQLiteDatabase,
  tratamientoId: string,
) {
  return {
    queryKey: [...RESPUESTAS_QUERY_KEY, tratamientoId],
    queryFn: () => getRespuestasByTratamiento(db, tratamientoId),
    gcTime: 0,
  };
}

type SaveRespuestasInput = {
  /** La evaluación entera tal como está en el formulario. */
  values: EvaluationFormValues;
  /** Solo estas se escriben: las demás conservan su estado de sincronización. */
  secciones: EvaluationSectionId[];
};

/**
 * Escribe las secciones indicadas. Fuera de la mutation porque hace falta
 * también al salir de la pantalla, cuando el componente ya se está
 * desmontando y su mutation no sobreviviría.
 */
export async function saveRespuestaSecciones(
  db: SQLiteDatabase,
  tratamientoId: string,
  { values, secciones }: SaveRespuestasInput,
): Promise<void> {
  // Una marca de tiempo para toda la tanda: lo que se guardó junto se capturó
  // junto, y así el orden de la cola del push no depende de en qué milisegundo
  // cayó cada fila.
  const updatedAtLocal = new Date().toISOString();

  // Sin transacción: cada sección es independiente por diseño, y si una falla,
  // que las otras hayan quedado guardadas es mejor que perderlas.
  for (const seccion of secciones) {
    await saveRespuesta(db, {
      tratamientoId,
      seccion,
      payload: values[seccion],
      updatedAtLocal,
    });
  }
}

/**
 * Escribe en SQLite las secciones que cambiaron.
 *
 * **No invalida su propia query a propósito.** Refrescarla volvería a volcar lo
 * guardado en el formulario, y con el autoguardado eso pasaría cada segundo:
 * el evaluador vería su campo reiniciarse mientras escribe. El formulario ya es
 * la copia viva; SQLite es el respaldo.
 *
 * Lo que sí invalida es el listado, para que la tarjeta de plantación se entere
 * de si la captura trae un error. Va con `exact` a propósito: sin él alcanzaría
 * también a `["plants", "respuestas", id]` y estaríamos releyendo de SQLite las
 * respuestas del tratamiento abierto cada dos segundos mientras se teclea.
 *
 * TODO(progreso): el mismo punto sirve cuando la tarjeta muestre el avance.
 */
export function useClearRespuestas(tratamientoId: string) {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteRespuestasByTratamiento(db, tratamientoId),
    // Como el guardado: el listado tiene que enterarse de que el avance cayó a
    // cero y de que el error de captura, si lo había, ya no está. Su propia
    // query no se invalida por lo mismo de siempre —el formulario es la copia
    // viva—, y quien limpia ya lo deja en blanco a mano.
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: PLANTS_QUERY_KEY,
        exact: true,
      });
    },
    onError: (error) => {
      toast.error({
        title: "No se pudo limpiar",
        description: error.message,
      });
    },
  });
}

export function useSaveRespuestas(tratamientoId: string) {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveRespuestasInput) =>
      saveRespuestaSecciones(db, tratamientoId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: PLANTS_QUERY_KEY,
        exact: true,
      });
    },
    onError: (error) => {
      toast.error({
        title: "No se pudo guardar",
        description: error.message,
      });
    },
  });
}
