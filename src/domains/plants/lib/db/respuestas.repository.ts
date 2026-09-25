import type { SQLiteDatabase } from "expo-sqlite";
import { SyncStatus, type RespuestaRecord } from "../../types";
import type {
  EvaluationFormValues,
  EvaluationSectionId,
} from "../evaluation-schema";
import { seccionHasError } from "../evaluation-errors";

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
    `INSERT INTO respuestas (tratamientoId, seccion, payload, syncStatus, updatedAtLocal, syncedAt, hasError)
     VALUES ($tratamientoId, $seccion, $payload, $syncStatus, $updatedAtLocal, NULL, $hasError)
     ON CONFLICT(tratamientoId, seccion) DO UPDATE SET
       payload = excluded.payload,
       syncStatus = excluded.syncStatus,
       updatedAtLocal = excluded.updatedAtLocal,
       syncedAt = excluded.syncedAt,
       hasError = excluded.hasError`,
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
 * La cola del push, de lo más viejo a lo más nuevo: lo que más tiempo lleva
 * esperando es lo que más arriesga perderse.
 */
export const getPendingRespuestas = async (
  db: SQLiteDatabase,
): Promise<RespuestaRecord[]> => {
  const rows = await db.getAllAsync<RespuestaRow>(
    "SELECT * FROM respuestas WHERE syncStatus = ? ORDER BY updatedAtLocal ASC",
    [SyncStatus.pending],
  );

  return rows.map(toRecord);
};

/**
 * Marca como sincronizada la sección **que se envió**, no la que hay ahora.
 *
 * Por eso pide el `updatedAtLocal` que viajó: si el evaluador editó la sección
 * mientras el push estaba en vuelo, la condición no encaja, no se actualiza
 * nada y la fila sigue pendiente. Sin esa comparación, ese cambio quedaría
 * marcado como sincronizado sin haber salido nunca de la tablet.
 */
export const markRespuestaSynced = async (
  db: SQLiteDatabase,
  {
    tratamientoId,
    seccion,
    updatedAtLocal,
  }: RespuestaKey & {
    updatedAtLocal: string;
  },
  syncedAt: string,
): Promise<void> => {
  await db.runAsync(
    `UPDATE respuestas
        SET syncStatus = $syncStatus, syncedAt = $syncedAt
      WHERE tratamientoId = $tratamientoId
        AND seccion = $seccion
        AND updatedAtLocal = $updatedAtLocal`,
    {
      $syncStatus: SyncStatus.synced,
      $syncedAt: syncedAt,
      $tratamientoId: tratamientoId,
      $seccion: seccion,
      $updatedAtLocal: updatedAtLocal,
    },
  );
};
