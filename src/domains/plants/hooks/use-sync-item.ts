import type { SQLiteDatabase } from "expo-sqlite";
import { useSQLiteContext } from "expo-sqlite";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { haptics } from "@/lib/haptics";
import {
  pushPostcosechaBatch,
  pushRespuestasBatch,
} from "../api/respuestas.api";
import type { WirePostcosechaRespuesta, WireRespuesta } from "../api/types";
import {
  applyPostcosechaPushOutcome,
  getPendingPostcosechaRespuestas,
  getPostcosechaSyncState,
  type SentPostcosechaKey,
} from "../lib/db/postcosecha-respuestas.repository";
import {
  applyRespuestasPushOutcome,
  getPendingRespuestas,
  getTratamientoSyncState,
  type SentRespuestaKey,
} from "../lib/db/respuestas.repository";
import { formatPushSummary, type PushReport } from "../lib/format-push-summary";
import {
  reconcilePostcosecha,
  reconcileRespuestas,
} from "../lib/sync-reconcile";
import { syncEligibility } from "../lib/sync-eligibility";
import { toPostcosechaWirePayload } from "../lib/postcosecha-wire";
import { toRespuestaWirePayload } from "../lib/respuesta-wire";
import { PLANTS_QUERY_KEY } from "./use-plants";

/**
 * Enviar lo capturado de **un** tratamiento o de **una** post-cosecha, desde la
 * pantalla donde se acaba de capturar.
 *
 * Qué alcance se manda. Sincronizar todo usará las mismas piezas con la cola sin
 * filtrar, así que la unión discriminada se queda aunque hoy tenga dos ramas.
 */
export type SyncScope =
  | { kind: "tratamiento"; tratamientoId: string }
  | { kind: "postcosecha"; plantId: string; evalId: string };

/**
 * Permite leer el estado en vuelo desde la caché (`useIsMutating`) en vez de
 * que cada consumidor monte su propio observer — el mismo truco de
 * `PLANTS_DOWNLOAD_MUTATION_KEY`.
 *
 * **Es también el motivo de que `syncing` no se escriba en SQLite**: una fila
 * marcada así cuando el sistema mata la app se queda ahí para siempre y nadie
 * la reintenta. Aquí el estado muere con el proceso, que es lo correcto.
 */
export const SYNC_ITEM_MUTATION_KEY = ["plants", "sync", "item"];

/** La clave de «cuánto le queda por enviar a este item» (ver `useItemSyncState`). */
export const SYNC_STATE_QUERY_KEY = [...PLANTS_QUERY_KEY, "sync-state"];

export const syncStateQueryKey = (scope: SyncScope) => [
  ...SYNC_STATE_QUERY_KEY,
  scope.kind === "tratamiento"
    ? scope.tratamientoId
    : `${scope.plantId}:${scope.evalId}`,
];

const EMPTY_REPORT: PushReport = {
  enviadas: 0,
  rechazadas: 0,
  pendientes: 0,
  blocked: false,
};

/**
 * `syncedAt` sale del reloj del dispositivo, al revés que el watermark del pull
 * —que usa el `server_time` del servidor para no depender de relojes
 * desajustados—. Aquí sí vale: la respuesta del lote **no trae `server_time`**, y
 * este dato es contabilidad local («cuándo marqué esto como enviado»), no algo
 * que se compare entre tablets.
 */
const ahora = () => new Date().toISOString();

/**
 * Manda las secciones pendientes de un tratamiento.
 *
 * Fuera de la mutation para poder probarla con SQLite de verdad y el módulo de
 * API mockeado, sin montar React. Es el mismo reparto que
 * `saveRespuestaSecciones`.
 */
export const pushTratamientoRespuestas = async (
  db: SQLiteDatabase,
  tratamientoId: string,
): Promise<PushReport> => {
  // Un dato imposible bloquea el item entero, no solo su sección. Va aquí y no
  // solo en el botón porque es la regla, no una cortesía de la interfaz: el día
  // que «sincronizar todo» mande cien plantaciones, este es el único sitio por
  // el que pasan todas.
  const eligibility = syncEligibility(
    await getTratamientoSyncState(db, tratamientoId),
  );
  if (eligibility.kind === "blocked") {
    return { ...EMPTY_REPORT, blocked: true };
  }

  const pendientes = await getPendingRespuestas(db, tratamientoId);
  const items: WireRespuesta[] = [];
  const sent: SentRespuestaKey[] = [];
  let ilegibles = 0;

  for (const fila of pendientes) {
    const payload = toRespuestaWirePayload(fila.seccion, fila.payload);

    // Una sección que no encaja con su esquema **no se manda y no se toca**: se
    // queda pendiente. Mandar `null`s donde no se pudo leer convertiría un dato
    // ilegible en uno vacío, que en el reporte es indistinguible de una
    // pregunta que nadie contestó.
    if (payload === null) {
      ilegibles += 1;
      continue;
    }

    items.push({
      evaluacion_id: fila.tratamientoId,
      seccion: fila.seccion,
      capturado_en: fila.updatedAtLocal,
      payload,
    });
    sent.push({
      tratamientoId: fila.tratamientoId,
      seccion: fila.seccion,
      updatedAtLocal: fila.updatedAtLocal,
    });
  }

  // Sin nada que mandar no se toca la red. Pulsar enviar con todo enviado tiene
  // que ser inofensivo, no una petición vacía.
  if (items.length === 0) {
    return { ...EMPTY_REPORT, pendientes: ilegibles };
  }

  const { results } = await pushRespuestasBatch(items);
  const outcome = reconcileRespuestas(sent, results);
  await applyRespuestasPushOutcome(db, outcome, ahora());

  return {
    enviadas: outcome.synced.length,
    rechazadas: outcome.rejected.length,
    pendientes: outcome.retry.length + ilegibles,
    blocked: false,
  };
};

/** Lo mismo para una de las cuatro evaluaciones de post-cosecha. */
export const pushPostcosechaRespuestas = async (
  db: SQLiteDatabase,
  plantId: string,
  evalId: string,
): Promise<PushReport> => {
  const eligibility = syncEligibility(
    await getPostcosechaSyncState(db, plantId, evalId),
  );
  if (eligibility.kind === "blocked") {
    return { ...EMPTY_REPORT, blocked: true };
  }

  const pendientes = await getPendingPostcosechaRespuestas(db, {
    plantId,
    evalId,
  });
  const items: WirePostcosechaRespuesta[] = [];
  const sent: SentPostcosechaKey[] = [];
  let ilegibles = 0;

  for (const fila of pendientes) {
    const payload = toPostcosechaWirePayload(fila.seccion, fila.payload);
    if (payload === null) {
      ilegibles += 1;
      continue;
    }

    items.push({
      plantacion_id: fila.plantId,
      eval_id: fila.evalId,
      seccion: fila.seccion,
      capturado_en: fila.updatedAtLocal,
      payload,
    });
    sent.push({
      plantId: fila.plantId,
      evalId: fila.evalId,
      seccion: fila.seccion,
      updatedAtLocal: fila.updatedAtLocal,
    });
  }

  if (items.length === 0) {
    return { ...EMPTY_REPORT, pendientes: ilegibles };
  }

  const { results } = await pushPostcosechaBatch(items);
  const outcome = reconcilePostcosecha(sent, results);
  await applyPostcosechaPushOutcome(db, outcome, ahora());

  return {
    enviadas: outcome.synced.length,
    rechazadas: outcome.rejected.length,
    pendientes: outcome.retry.length + ilegibles,
    blocked: false,
  };
};

export function useSyncItem(scope: SyncScope) {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: SYNC_ITEM_MUTATION_KEY,
    mutationFn: () =>
      scope.kind === "tratamiento"
        ? pushTratamientoRespuestas(db, scope.tratamientoId)
        : pushPostcosechaRespuestas(db, scope.plantId, scope.evalId),
    onSuccess: (report) => {
      // Dos claves: el listado, para que la tarjeta deje de decir «Pendiente»,
      // y el conteo del item, que es lo que apaga el botón. `exact` en la
      // primera por lo mismo que en el guardado — sin él, la invalidación
      // alcanza a la query de respuestas y relee el formulario abierto.
      queryClient.invalidateQueries({
        queryKey: PLANTS_QUERY_KEY,
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: syncStateQueryKey(scope) });

      // No es un fallo del envío: es que no había que intentarlo. Por eso lleva
      // el aviso rojo y no el verde, y dice qué hacer en vez de qué pasó.
      if (report.blocked) {
        haptics.error();
        toast.error({
          title: "No se puede enviar",
          description: "Hay un dato por revisar en esta captura.",
        });
        return;
      }

      haptics.success();
      toast.success({
        title: "Envío completo",
        description: formatPushSummary(report),
      });
    },
    onError: (error) => {
      haptics.error();
      toast.error({ title: "Error de envío", description: error.message });
    },
  });
}
