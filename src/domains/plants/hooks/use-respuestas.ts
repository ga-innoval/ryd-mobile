import { useSQLiteContext } from "expo-sqlite";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import {
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

/** Lo guardado de un tratamiento, para volcarlo al formulario al abrirlo. */
export function useRespuestas(tratamientoId: string) {
  const db = useSQLiteContext();

  return useQuery({
    queryKey: [...RESPUESTAS_QUERY_KEY, tratamientoId],
    queryFn: () => getRespuestasByTratamiento(db, tratamientoId),
  });
}

type SaveRespuestasInput = {
  /** La evaluación entera tal como está en el formulario. */
  values: EvaluationFormValues;
  /** Solo estas se escriben: las demás conservan su estado de sincronización. */
  secciones: EvaluationSectionId[];
};

/**
 * Escribe en SQLite las secciones que cambiaron.
 *
 * **No invalida su propia query a propósito.** Refrescarla volvería a volcar lo
 * guardado en el formulario, y con el autoguardado eso pasaría cada segundo:
 * el evaluador vería su campo reiniciarse mientras escribe. El formulario ya es
 * la copia viva; SQLite es el respaldo.
 *
 * TODO(progreso): cuando la tarjeta de plantación muestre estado y avance, aquí
 * va el `invalidateQueries(PLANTS_QUERY_KEY)` — es el único punto por el que
 * pasa toda escritura, así que la tarjeta se enterará sin cablear nada más.
 */
export function useSaveRespuestas(tratamientoId: string) {
  const db = useSQLiteContext();

  return useMutation({
    mutationFn: async ({ values, secciones }: SaveRespuestasInput) => {
      // Una marca de tiempo para toda la tanda: lo que se guardó junto se
      // capturó junto, y así el orden de la cola del push no depende de en qué
      // milisegundo cayó cada fila.
      const updatedAtLocal = new Date().toISOString();

      // Sin transacción: cada sección es independiente por diseño, y si una
      // falla, que las otras hayan quedado guardadas es mejor que perderlas.
      for (const seccion of secciones) {
        await saveRespuesta(db, {
          tratamientoId,
          seccion,
          payload: values[seccion],
          updatedAtLocal,
        });
      }
    },
    onError: (error) => {
      toast.error({
        title: "No se pudo guardar",
        description: error.message,
      });
    },
  });
}
