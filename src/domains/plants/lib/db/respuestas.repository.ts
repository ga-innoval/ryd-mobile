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
import { getFotoCategoriaCounts } from "./respuesta-fotos.repository";

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
