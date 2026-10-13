import type { SQLiteDatabase } from "expo-sqlite";
import { SyncStatus, type RespuestaRecord } from "../../types";
import type {
  EvaluationFormValues,
  EvaluationSectionId,
} from "../evaluation-schema";
import { seccionHasError } from "../evaluation-errors";
import {
  PROGRESS_SECTIONS,
  seccionProgress,
  formatProgress,
  fotografiasProgress,
} from "../evaluation-progress";
import {
  getFotoCategoriaCounts,
  getFotoSyncCounts,
} from "./respuesta-fotos.repository";

// La fila tal como vive en SQLite: el payload es texto y los enums son strings
// sueltos, porque SQLite no sabe de tipos nuestros.
type RespuestaRow = {
  tratamientoId: string;
  seccion: string;
  payload: string;
  syncStatus: string;
  updatedAtLocal: string;
  syncedAt: string | null;
};

const toRecord = (row: RespuestaRow): RespuestaRecord => ({
  tratamientoId: row.tratamientoId,
  seccion: row.seccion as EvaluationSectionId,
  syncStatus: row.syncStatus as SyncStatus,
  payload: JSON.parse(row.payload),
  updatedAtLocal: row.updatedAtLocal,
  syncedAt: row.syncedAt,
});

/** Lo que identifica una respuesta: no hay UUID, la llave es natural. */
export type RespuestaKey = {
  tratamientoId: string;
  seccion: EvaluationSectionId;
};

/**
 * El genérico ata el payload a su sección: pasar los valores de criba con
 * `seccion: "brix"` deja de compilar. Es el error que la llave natural no puede
 * atrapar sola, porque los dos son objetos.
 */
type SaveRespuestaInput<S extends EvaluationSectionId> = {
  tratamientoId: string;
  seccion: S;
  /** Tal como se capturó: los números, como texto. */
  payload: EvaluationFormValues[S];
  /** Cuándo se guardó, en ISO. Lo pone quien llama para no meter reloj aquí. */
  updatedAtLocal: string;
};

/**
 * Las secciones capturadas de un tratamiento, para rehidratar el formulario.
 *
 * Una sección que nadie tocó no tiene fila, y eso **no** es lo mismo que una
 * fila con la sección vacía: es el mismo "vacío no es cero" de Brix y Criba un
 * nivel más arriba. Quien reconstruya el formulario completa lo que falte con
 * `buildEvaluationDefaults`.
 */
export const getRespuestasByTratamiento = async (
  db: SQLiteDatabase,
  tratamientoId: string,
): Promise<RespuestaRecord[]> => {
  const rows = await db.getAllAsync<RespuestaRow>(
    "SELECT * FROM respuestas WHERE tratamientoId = ?",
    [tratamientoId],
  );

  return rows.map(toRecord);
};

/**
 * Borra todo lo capturado de un tratamiento.
 *
 * Borra las filas en vez de dejarlas con el payload vacío, y esa es la
 * diferencia que el modelo ya distingue: *sin fila* es una sección que nadie
 * tocó, *fila vacía* es una capturada y vaciada. Limpiar significa lo primero —
 * el tratamiento vuelve a avance cero, chip «Sin iniciar» y fuera del filtro de
 * iniciadas—, que es lo que espera quien pulsa el botón.
 *
 * **No toca las fotografías**: cuelgan de `tratamientos`, no de aquí, así que
 * ninguna CASCADE las alcanza. Quien limpia las borra aparte, porque además hay
 * archivos en disco de por medio.
 *
 * Pendiente para el día del push: limpiar algo **ya sincronizado** no deja
 * rastro local que contarle al servidor. Es la misma lápida que ya está anotada
 * para las fotografías, no un hueco nuevo.
 */
export const deleteRespuestasByTratamiento = async (
  db: SQLiteDatabase,
  tratamientoId: string,
): Promise<void> => {
  await db.runAsync("DELETE FROM respuestas WHERE tratamientoId = ?", [
    tratamientoId,
  ]);
};

/**
 * Guarda una sección. La vuelve a dejar pendiente y le quita el `syncedAt`:
 * cualquier cambio posterior a la última subida es trabajo que el servidor
 * todavía no tiene.
 *
 * `ON CONFLICT DO UPDATE` y no `INSERT OR REPLACE`, igual que en `upsertPlant`:
 * REPLACE borra e inserta, y el día que algo cuelgue de esta tabla —las
 * fotografías— se lo llevaría por delante en cada guardado.
 */
export const saveRespuesta = async <S extends EvaluationSectionId>(
  db: SQLiteDatabase,
  { tratamientoId, seccion, payload, updatedAtLocal }: SaveRespuestaInput<S>,
): Promise<void> => {
  await db.runAsync(
    `INSERT INTO respuestas (tratamientoId, seccion, payload, syncStatus, updatedAtLocal, syncedAt, hasError, progress)
     VALUES ($tratamientoId, $seccion, $payload, $syncStatus, $updatedAtLocal, NULL, $hasError, $progress)
     ON CONFLICT(tratamientoId, seccion) DO UPDATE SET
       payload = excluded.payload,
       syncStatus = excluded.syncStatus,
       updatedAtLocal = excluded.updatedAtLocal,
       syncedAt = excluded.syncedAt,
       hasError = excluded.hasError,
       progress = excluded.progress`,
    {
      $tratamientoId: tratamientoId,
      $seccion: seccion,
      $payload: JSON.stringify(payload),
      $syncStatus: SyncStatus.pending,
      $updatedAtLocal: updatedAtLocal,
      // La marca se calcula aquí y no la trae quien llama: así no hay forma de
      // escribir una fila cuyo `hasError` no corresponda con su `payload`, que
      // es lo único que hace seguro guardar un dato derivado.
      $hasError: seccionHasError(seccion, payload) ? 1 : 0,
      $progress: formatProgress(seccionProgress(seccion, payload)),
    },
  );
};

/**
 * Los tratamientos con alguna captura marcada con un dato imposible.
 *
 * SQL puro contra la columna `hasError`: no abre un solo `payload`, así que el
 * listado responde igual de rápido con diez capturas que con diez mil. Usa el
 * índice parcial `idx_respuestas_hasError`, que solo contiene las filas
 * marcadas.
 */
export const getTratamientoIdsWithErrors = async (
  db: SQLiteDatabase,
): Promise<Set<string>> => {
  const rows = await db.getAllAsync<{ tratamientoId: string }>(
    "SELECT DISTINCT tratamientoId FROM respuestas WHERE hasError = 1",
  );

  return new Set(rows.map((row) => row.tratamientoId));
};

/**
 * Los tratamientos con algo capturado que todavía no ha salido de la tablet.
 *
 * Mira **sus dos tablas**, secciones y fotografías, porque el evaluador no
 * distingue entre ellas: lo que pregunta el chip es si a ese tratamiento le
 * falta mandar algo. Los dos `SELECT` caen dentro de los índices parciales de la
 * v10, que solo contienen filas pendientes, así que esto no recorre la tabla.
 *
 * Ids y no un booleano por plantación, por lo mismo que `getTratamientoIdsWithErrors`:
 * la tarjeta señala **cuál** de los chips hay que mandar, y de ahí sale si la
 * plantación entera tiene algo pendiente.
 *
 * `rejected_closed` no cuenta: no hay nada que reintentar hasta que un
 * administrador reabra la encuesta, y marcarlo como pendiente dejaría el icono
 * encendido para siempre sin que nadie pudiera apagarlo.
 */
export const getTratamientoIdsWithPendingSync = async (
  db: SQLiteDatabase,
): Promise<Set<string>> => {
  const rows = await db.getAllAsync<{ tratamientoId: string }>(
    `SELECT tratamientoId FROM respuestas WHERE syncStatus = ?
      UNION
     SELECT tratamientoId FROM respuesta_fotos WHERE syncStatus = ?`,
    [SyncStatus.pending, SyncStatus.pending],
  );

  return new Set(rows.map((row) => row.tratamientoId));
};

/**
 * Cuánto lleva capturado cada tratamiento, de 0 a 1.
 *
 * Suma en SQL y divide entre las secciones que reparten, así que las que no
 * tienen fila cuentan cero — que es lo correcto: sin capturar es 0 %. Los
 * comentarios quedan fuera del `IN` porque no reparten avance.
 *
 * Las fotografías viven en su propia tabla y se suman aparte, contando tomas con
 * al menos una. Por eso se recorre la **unión** de los dos juegos de ids y no
 * las filas del SUM: un tratamiento con fotografías y sin ninguna sección
 * capturada no aparece en `respuestas` y se quedaría en cero.
 */
export const getTratamientoProgress = async (
  db: SQLiteDatabase,
): Promise<Map<string, number>> => {
  const placeholders = PROGRESS_SECTIONS.map(() => "?").join(",");
  const [rows, fotos] = await Promise.all([
    db.getAllAsync<{ tratamientoId: string; total: number }>(
      `SELECT tratamientoId, SUM(progress) AS total
         FROM respuestas
        WHERE seccion IN (${placeholders})
        GROUP BY tratamientoId`,
      [...PROGRESS_SECTIONS],
    ),
    getFotoCategoriaCounts(db),
  ]);

  const secciones = new Map(rows.map((row) => [row.tratamientoId, row.total]));
  const ids = new Set([...secciones.keys(), ...fotos.keys()]);

  return new Map(
    [...ids].map((tratamientoId) => {
      const total =
        (secciones.get(tratamientoId) ?? 0) +
        formatProgress(fotografiasProgress(fotos.get(tratamientoId) ?? 0));

      return [tratamientoId, total / (PROGRESS_SECTIONS.length * 100)];
    }),
  );
};

/**
 * La cola del push, de lo más viejo a lo más nuevo: lo que más tiempo lleva
 * esperando es lo que más arriesga perderse.
 *
 * Con `tratamientoId` es la cola de uno solo, que es lo que manda el botón de
 * la pantalla de captura; sin él, la de todos. **Un argumento opcional y no un
 * lector aparte**: es la misma pregunta con el alcance cambiado, y de dos
 * cadenas de SQL salen dos sitios donde equivocarse. El índice parcial
 * `idx_respuestas_pending` sirve a las dos formas, porque lleva el dueño en la
 * clave y dentro solo hay filas pendientes.
 *
 * Lo que **no** entra aquí es `rejected_closed`: una encuesta cerrada no se
 * arregla reintentando, así que esa fila sale de la cola hasta que alguien la
 * edite —y entonces `saveRespuesta` la devuelve a `pending` sola—.
 */
export const getPendingRespuestas = async (
  db: SQLiteDatabase,
  tratamientoId?: string,
): Promise<RespuestaRecord[]> => {
  const rows = await db.getAllAsync<RespuestaRow>(
    `SELECT * FROM respuestas
      WHERE syncStatus = ?${tratamientoId ? " AND tratamientoId = ?" : ""}
      ORDER BY updatedAtLocal ASC`,
    tratamientoId ? [SyncStatus.pending, tratamientoId] : [SyncStatus.pending],
  );

  return rows.map(toRecord);
};

/** La sección tal como se envió, que es contra lo que se compara al volver. */
export type SentRespuestaKey = RespuestaKey & { updatedAtLocal: string };

/**
 * El resultado del envío de una sección, escrito **solo sobre la fila que
 * viajó**.
 *
 * Por eso pide el `updatedAtLocal` que se mandó y lo pone en el `WHERE`: si el
 * evaluador editó la sección mientras el push estaba en vuelo, la condición no
 * encaja, no se actualiza nada y la fila sigue pendiente. Sin esa comparación,
 * ese cambio quedaría marcado como sincronizado sin haber salido nunca de la
 * tablet.
 */
const markRespuesta = async (
  db: SQLiteDatabase,
  { tratamientoId, seccion, updatedAtLocal }: SentRespuestaKey,
  syncStatus: SyncStatus,
  syncedAt: string | null,
): Promise<void> => {
  await db.runAsync(
    `UPDATE respuestas
        SET syncStatus = $syncStatus, syncedAt = $syncedAt
      WHERE tratamientoId = $tratamientoId
        AND seccion = $seccion
        AND updatedAtLocal = $updatedAtLocal`,
    {
      $syncStatus: syncStatus,
      $syncedAt: syncedAt,
      $tratamientoId: tratamientoId,
      $seccion: seccion,
      $updatedAtLocal: updatedAtLocal,
    },
  );
};

/** La sección llegó al servidor. */
export const markRespuestaSynced = (
  db: SQLiteDatabase,
  key: SentRespuestaKey,
  syncedAt: string,
): Promise<void> => markRespuesta(db, key, SyncStatus.synced, syncedAt);

/**
 * El servidor rechazó la sección y reintentar no va a cambiarlo —la encuesta
 * está cerrada—.
 *
 * **Sale de la cola pero `syncedAt` se queda en `NULL`**: no llegó a ningún
 * sitio, y poner la fecha diría que sí. Es lo único que se persiste de un fallo:
 * un error de red deja la fila en `pending` justamente para que el siguiente
 * envío la recoja, y escribir aquí un `error` la sacaría de la cola para
 * siempre.
 *
 * No es un callejón sin salida: `saveRespuesta` reescribe `pending` en cada
 * guardado, así que si la encuesta se reabre y el evaluador toca la sección,
 * vuelve a la cola sola.
 */
export const markRespuestaRejected = (
  db: SQLiteDatabase,
  key: SentRespuestaKey,
): Promise<void> => markRespuesta(db, key, SyncStatus.rejected_closed, null);

/**
 * Lo que decide si el botón de enviar se enciende: cuánto queda sin mandar y si
 * hay algún dato imposible. Las dos preguntas en un solo viaje, porque se
 * contestan siempre juntas (ver `syncEligibility`).
 *
 * `hasError` mira **todas** las filas y no solo las pendientes: la marca está
 * guardada por el propio guardado, así que preguntarla no abre ningún payload.
 */
export type RespuestasSyncState = {
  /**
   * Cuántas filas hay capturadas, enviadas o no.
   *
   * Sirve para distinguir «no hay nada que mandar porque ya se mandó todo» de
   * «no hay nada que mandar porque no se ha capturado nada». Sin eso, una
   * evaluación en blanco diría «Sincronizado» de entrada, que suena a que algo
   * salió cuando no hay nada.
   */
  captured: number;
  pending: number;
  /**
   * Rechazadas por encuesta cerrada. **No están pendientes** —reintentarlas no
   * abre la encuesta— pero tampoco están enviadas, así que sin contarlas la
   * cabecera diría «Enviado» sobre un dato que el servidor no tiene.
   *
   * Y se cuentan de la fila y no del resultado de la última mutation porque esto
   * tiene que sobrevivir a salir de la pantalla y volver: el rechazo sigue ahí
   * hasta que un administrador reabra.
   */
  rejected: number;
  hasError: boolean;
};

export const getTratamientoSyncState = async (
  db: SQLiteDatabase,
  tratamientoId: string,
): Promise<RespuestasSyncState> => {
  // Las fotografías van en el mismo conteo: el evaluador no distingue entre las
  // dos tablas, y contar solo secciones haría que un tratamiento con fotos sin
  // subir dijera «Enviado» sin serlo.
  const [row, fotos] = await Promise.all([
    db.getFirstAsync<{
      captured: number;
      pending: number;
      rejected: number;
      hasError: number;
    }>(
      `SELECT
         COUNT(*) AS captured,
         COALESCE(SUM(CASE WHEN syncStatus = $pending THEN 1 ELSE 0 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN syncStatus = $rejected THEN 1 ELSE 0 END), 0) AS rejected,
         COALESCE(MAX(hasError), 0) AS hasError
       FROM respuestas
       WHERE tratamientoId = $tratamientoId`,
      {
        $pending: SyncStatus.pending,
        $rejected: SyncStatus.rejected_closed,
        $tratamientoId: tratamientoId,
      },
    ),
    getFotoSyncCounts(db, tratamientoId),
  ]);

  return {
    captured: (row?.captured ?? 0) + fotos.captured,
    pending: (row?.pending ?? 0) + fotos.pending,
    rejected: (row?.rejected ?? 0) + fotos.rejected,
    hasError: (row?.hasError ?? 0) === 1,
  };
};

/**
 * Escribe el veredicto del envío.
 *
 * **`retry` no se toca**: esas filas ya están en `pending`, y dejarlas así es
 * justo lo que hace que el siguiente envío las recoja sin reconciliar nada. Que
 * el caso más común no tenga escritura es la razón de que esto sea un bucle
 * aburrido y no una transacción.
 *
 * Sin `withTransactionAsync` a propósito: cada fila es independiente y marcar
 * tres de cinco es mejor que no marcar ninguna. Si la app muere en medio, lo
 * marcado queda marcado y lo demás sigue pendiente —y reenviar lo ya enviado no
 * duplica, porque la llave es natural—.
 */
export const applyRespuestasPushOutcome = async (
  db: SQLiteDatabase,
  outcome: {
    synced: readonly SentRespuestaKey[];
    rejected: readonly SentRespuestaKey[];
  },
  syncedAt: string,
): Promise<void> => {
  for (const key of outcome.synced) {
    await markRespuestaSynced(db, key, syncedAt);
  }
  for (const key of outcome.rejected) {
    await markRespuestaRejected(db, key);
  }
};
