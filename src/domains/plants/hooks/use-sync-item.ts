import type { SQLiteDatabase } from "expo-sqlite";
import { useSQLiteContext } from "expo-sqlite";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { haptics } from "@/lib/haptics";
import { uploadFoto, uploadPostcosechaFoto } from "../api/foto-upload.api";
import {
  pushPostcosechaBatch,
  pushRespuestasBatch,
} from "../api/respuestas.api";
import type { WirePostcosechaRespuesta, WireRespuesta } from "../api/types";
import type { RespuestaRecord } from "../types";
import {
  getPendingPostcosechaFotos,
  markPostcosechaFotoRejected,
  markPostcosechaFotoSynced,
} from "../lib/db/postcosecha-fotos.repository";
import {
  applyPostcosechaPushOutcome,
  getPendingPostcosechaRespuestas,
  getPostcosechaSyncState,
  type PostcosechaRespuestaRecord,
  type SentPostcosechaKey,
} from "../lib/db/postcosecha-respuestas.repository";
import {
  getPendingFotos,
  markFotoRejected,
  markFotoSynced,
} from "../lib/db/respuesta-fotos.repository";
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
import type { UploadOutcome } from "../lib/upload-outcome";
import { PLANTS_QUERY_KEY } from "./use-plants";
import {
  syncItemMutationKey,
  syncStateQueryKey,
  type SyncScope,
} from "./use-item-sync-state";

const EMPTY_REPORT: PushReport = {
  enviadas: 0,
  fotos: 0,
  rechazadas: 0,
  pendientes: 0,
  blocked: false,
};

type FotosReport = { enviadas: number; rechazadas: number; pendientes: number };

/**
 * Sube las fotografías pendientes **una a una, en serie**, y marca cada una en
 * cuanto el servidor contesta.
 *
 * Dos decisiones que están aquí y no se ven en el bucle:
 *
 * - **En serie y no en paralelo.** El cuello de botella es la subida, así que
 *   siete multipart a la vez sobre una conexión de campo hacen las siete lentas
 *   y las siete más propensas a agotar el `timeout`.
 * - **Marcando de a una.** Si la app muere a mitad, lo que ya subió queda
 *   marcado y el siguiente envío reintenta solo el resto. Con una sola escritura
 *   al final, una muerte en el archivo cinco de siete tiraría los cuatro
 *   primeros.
 *
 * **Una que falle no detiene a las demás ni desmarca el texto**: son ciclos de
 * vida distintos, que es exactamente la razón de que el contrato pida una
 * petición por archivo.
 */
export const subirFotos = async <F extends { clientId: string }>(
  fotos: readonly F[],
  upload: (foto: F) => Promise<UploadOutcome>,
  markSynced: (clientId: string) => Promise<void>,
  markRejected: (clientId: string) => Promise<void>,
): Promise<FotosReport> => {
  const report: FotosReport = { enviadas: 0, rechazadas: 0, pendientes: 0 };

  for (const foto of fotos) {
    const outcome = await upload(foto);

    if (outcome.kind === "ok") {
      await markSynced(foto.clientId);
      report.enviadas += 1;
    } else if (outcome.kind === "rejected") {
      await markRejected(foto.clientId);
      report.rechazadas += 1;
    } else {
      // `failed` y `missing`: la fila se queda pendiente. Un archivo que ya no
      // está en disco no se puede subir nunca, pero borrar su fila aquí sería
      // destructivo ante un fallo temporal de lectura — de eso se encarga la
      // barrida de la descarga.
      report.pendientes += 1;
    }
  }

  return report;
};

/**
 * `syncedAt` sale del reloj del dispositivo, al revés que el watermark del pull
 * —que usa el `server_time` del servidor para no depender de relojes
 * desajustados—. Aquí sí vale: la respuesta del lote **no trae `server_time`**, y
 * este dato es contabilidad local («cuándo marqué esto como enviado»), no algo
 * que se compare entre tablets.
 */
export const ahora = () => new Date().toISOString();

/**
 * Manda las secciones pendientes de un tratamiento.
 *
 * Fuera de la mutation para poder probarla con SQLite de verdad y el módulo de
 * API mockeado, sin montar React. Es el mismo reparto que
 * `saveRespuestaSecciones`.
 */
/** Lo que un lote deja: cuántas llegaron, cuántas se rechazaron y cuántas no. */
export type RowsReport = {
  enviadas: number;
  rechazadas: number;
  pendientes: number;
};

/**
 * Manda **las filas que se le den**, sin preguntarse de quién son.
 *
 * Partido así porque es exactamente lo que comparten enviar un tratamiento y
 * enviar todo: lo único que cambia es qué filas entran en la lista. Un lote por
 * llamada, nunca una petición por sección — en campo lo escaso es la conexión.
 */
export const pushRespuestaRows = async (
  db: SQLiteDatabase,
  filas: readonly RespuestaRecord[],
): Promise<RowsReport & { ilegibles: number }> => {
  const items: WireRespuesta[] = [];
  const sent: SentRespuestaKey[] = [];
  let ilegibles = 0;

  for (const fila of filas) {
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

  // Sin nada que mandar no se toca la red: pulsar enviar con el texto ya enviado
  // y una foto pendiente tiene que subir la foto, no hacer una petición vacía
  // antes.
  if (items.length === 0) {
    return { enviadas: 0, rechazadas: 0, pendientes: 0, ilegibles };
  }

  const { results } = await pushRespuestasBatch(items);
  const outcome = reconcileRespuestas(sent, results);
  await applyRespuestasPushOutcome(db, outcome, ahora());

  return {
    enviadas: outcome.synced.length,
    rechazadas: outcome.rejected.length,
    pendientes: outcome.retry.length,
    ilegibles,
  };
};

/** El mismo núcleo para post-cosecha, con su llave de tres partes. */
export const pushPostcosechaRows = async (
  db: SQLiteDatabase,
  filas: readonly PostcosechaRespuestaRecord[],
): Promise<RowsReport & { ilegibles: number }> => {
  const items: WirePostcosechaRespuesta[] = [];
  const sent: SentPostcosechaKey[] = [];
  let ilegibles = 0;

  for (const fila of filas) {
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
    return { enviadas: 0, rechazadas: 0, pendientes: 0, ilegibles };
  }

  const { results } = await pushPostcosechaBatch(items);
  const outcome = reconcilePostcosecha(sent, results);
  await applyPostcosechaPushOutcome(db, outcome, ahora());

  return {
    enviadas: outcome.synced.length,
    rechazadas: outcome.rejected.length,
    pendientes: outcome.retry.length,
    ilegibles,
  };
};

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

  // **El texto primero y las fotografías después, y es una dependencia de orden,
  // no una preferencia.** El lote va por `apiClient`, que refresca el token en un
  // 401; la subida de fotos no pasa por ahí y lleva el bearer a mano. Mandando el
  // texto primero, las subidas salen con un token fresco. Invertir los dos pasos
  // rompe el refresco en silencio.
  const secciones = await pushRespuestaRows(
    db,
    await getPendingRespuestas(db, tratamientoId),
  );

  const fotos = await subirFotos(
    await getPendingFotos(db, tratamientoId),
    uploadFoto,
    (clientId) => markFotoSynced(db, clientId, ahora()),
    (clientId) => markFotoRejected(db, clientId),
  );

  return {
    enviadas: secciones.enviadas,
    fotos: fotos.enviadas,
    rechazadas: secciones.rechazadas + fotos.rechazadas,
    pendientes: secciones.pendientes + secciones.ilegibles + fotos.pendientes,
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

  const secciones = await pushPostcosechaRows(
    db,
    await getPendingPostcosechaRespuestas(db, { plantId, evalId }),
  );

  const fotos = await subirFotos(
    await getPendingPostcosechaFotos(db, { plantId, evalId }),
    uploadPostcosechaFoto,
    (clientId) => markPostcosechaFotoSynced(db, clientId, ahora()),
    (clientId) => markPostcosechaFotoRejected(db, clientId),
  );

  return {
    enviadas: secciones.enviadas,
    fotos: fotos.enviadas,
    rechazadas: secciones.rechazadas + fotos.rechazadas,
    pendientes: secciones.pendientes + secciones.ilegibles + fotos.pendientes,
    blocked: false,
  };
};

export function useSyncItem(scope: SyncScope) {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: syncItemMutationKey(scope),
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
        title: "Sincronización completa",
        description: formatPushSummary(report),
      });
    },
    onError: (error) => {
      haptics.error();
      toast.error({ title: "Error de envío", description: error.message });
    },
  });
}
