import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import {
  deletePostcosechaRespuestas,
  getPostcosechaRespuestas,
  savePostcosechaRespuesta,
} from "../lib/db/postcosecha-respuestas.repository";
import type {
  PostcosechaFormValues,
  PostcosechaSectionId,
} from "../lib/postcosecha-schema";
import { PLANTS_QUERY_KEY } from "./use-plants";

// Cuelga de `["plants"]` como el resto: así la invalidación que dispara una
// descarga alcanza también a lo capturado.
export const POSTCOSECHA_RESPUESTAS_QUERY_KEY = [
  ...PLANTS_QUERY_KEY,
  "postcosecha-respuestas",
];

/**
 * Lo guardado de una evaluación, para volcarlo al formulario al abrirla.
 *
 * **Su caché no sobrevive a la pantalla (`gcTime: 0`), y aquí eso pesa aún más
 * que en tratamiento.** Allí el riesgo aparece al reabrir la pantalla; aquí la
 * navegación normal son los cuatro chips **sobre la misma pantalla montada**:
 * se captura en «15 días / caja», se salta a «30 días / plástico» y se vuelve.
 * Con caché, esa vuelta entregaría lo cacheado en el primer render, el volcado
 * correría justo después y se quedaría clavado en el estado **anterior** a lo
 * último escrito.
 *
 * Sin caché que heredar, `data` llega `undefined` al montar y el volcado espera
 * al dato real. De ahí sale una obligación para la pantalla: mientras el
 * `SELECT` está en vuelo no hay nada que enseñar, así que el formulario tiene
 * que vaciarse **ya** al cambiar de evaluación en vez de esperar a SQLite, o se
 * vería un instante lo de la evaluación anterior.
 */
export function usePostcosechaRespuestas(plantId: string, evalId: string) {
  const db = useSQLiteContext();

  return useQuery(postcosechaRespuestasQueryOptions(db, plantId, evalId));
}

/**
 * Las opciones del hook, aparte para que el test monte un observador con las
 * mismas: copiarlas en el test dejaría que quitar el `gcTime` pasara en verde.
 */
export function postcosechaRespuestasQueryOptions(
  db: SQLiteDatabase,
  plantId: string,
  evalId: string,
) {
  return {
    queryKey: [...POSTCOSECHA_RESPUESTAS_QUERY_KEY, plantId, evalId],
    queryFn: () => getPostcosechaRespuestas(db, plantId, evalId),
    enabled: !!plantId && !!evalId,
    gcTime: 0,
  };
}

type SavePostcosechaInput = {
  /** La evaluación entera tal como está en el formulario. */
  values: PostcosechaFormValues;
  /** Solo estas se escriben: las demás conservan su estado de sincronización. */
  secciones: PostcosechaSectionId[];
};

/**
 * Escribe las secciones indicadas. Fuera de la mutation porque hace falta
 * también al salir de la pantalla, cuando el componente ya se está desmontando
 * y su mutation no sobreviviría.
 */
export async function savePostcosechaSecciones(
  db: SQLiteDatabase,
  plantId: string,
  evalId: string,
  { values, secciones }: SavePostcosechaInput,
): Promise<void> {
  // Una marca de tiempo para toda la tanda: lo que se guardó junto se capturó
  // junto, y así el orden de la cola del push no depende de en qué milisegundo
  // cayó cada fila.
  const updatedAtLocal = new Date().toISOString();

  // Sin transacción: cada sección es independiente por diseño, y si una falla,
  // que la otra haya quedado guardada es mejor que perder las dos.
  for (const seccion of secciones) {
    await savePostcosechaRespuesta(db, {
      plantId,
      evalId,
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
 * guardado en el formulario, y con el autoguardado eso pasaría cada dos
 * segundos: el evaluador vería su campo reiniciarse mientras escribe. El
 * formulario ya es la copia viva; SQLite es el respaldo.
 *
 * El `exact` del listado no es adorno: sin él la invalidación alcanzaría también
 * a `["plants", "postcosecha-respuestas", ...]` —y a las respuestas de
 * tratamiento— y estaríamos releyendo de SQLite el formulario abierto cada dos
 * segundos mientras se teclea.
 *
 * Hoy el listado no cuenta post-cosecha para el avance, así que esta
 * invalidación todavía no mueve nada en la tarjeta. Se pone igualmente porque es
 * el punto exacto donde tiene que estar el día que la cuente, y porque olvidarla
 * entonces daría una tarjeta desfasada difícil de atribuir.
 */
export function usePostcosechaSave(plantId: string, evalId: string) {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SavePostcosechaInput) =>
      savePostcosechaSecciones(db, plantId, evalId, input),
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

/**
 * Borra lo capturado de **esta** evaluación, no de las cuatro.
 *
 * Las fotografías no las alcanza —viven en otra tabla y tienen archivos
 * detrás—: las borra aparte quien limpia.
 */
export function usePostcosechaClear(plantId: string, evalId: string) {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deletePostcosechaRespuestas(db, plantId, evalId),
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
