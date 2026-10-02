import type { SQLiteDatabase } from "expo-sqlite";
import { SyncStatus } from "../../types";
import type {
  PostcosechaFormValues,
  PostcosechaSectionId,
} from "../postcosecha-schema";
import { postcosechaSeccionHasError } from "../postcosecha-errors";
import {
  postcosechaKey,
  postcosechaProgressFromRow,
  postcosechaSeccionProgress,
  POSTCOSECHA_PROGRESS_SECTIONS,
} from "../postcosecha-progress";
import { getPostcosechaFotoCategoriaCounts } from "./postcosecha-fotos.repository";
import { formatProgress } from "../evaluation-progress";

/**
 * Lo capturado en post-cosecha, sección a sección.
 *
 * Hermano de `respuestas.repository.ts` y con las mismas reglas —una fila por
 * sección, llave natural, el derivado calculado dentro del guardado—. Lo que
 * cambia es el dueño: allí un tratamiento, aquí la plantación más cuál de las
 * cuatro evaluaciones del catálogo.
 */

// La fila tal como vive en SQLite: el payload es texto y los enums son strings
// sueltos, porque SQLite no sabe de tipos nuestros.
type PostcosechaRespuestaRow = {
  plantId: string;
  evalId: string;
  seccion: string;
  payload: string;
  syncStatus: string;
  updatedAtLocal: string;
  syncedAt: string | null;
};

/**
 * Una sección capturada. `payload` sale de SQLite como texto, así que aquí es
 * `unknown` y no el tipo de la sección: quien lo lea decide con qué esquema
 * validarlo. Al guardar sí está tipado.
 */
export type PostcosechaRespuestaRecord = {
  plantId: string;
  evalId: string;
  seccion: PostcosechaSectionId;
  payload: unknown;
  syncStatus: SyncStatus;
  /** Cuándo se guardó en la tablet. Lo pone quien llama, en ISO. */
  updatedAtLocal: string;
  /** `null` mientras no haya llegado al servidor. */
  syncedAt: string | null;
};

const toRecord = (
  row: PostcosechaRespuestaRow,
): PostcosechaRespuestaRecord => ({
  plantId: row.plantId,
  evalId: row.evalId,
  seccion: row.seccion as PostcosechaSectionId,
  syncStatus: row.syncStatus as SyncStatus,
  payload: JSON.parse(row.payload),
  updatedAtLocal: row.updatedAtLocal,
  syncedAt: row.syncedAt,
});

/**
 * El genérico ata el payload a su sección: pasar las notas con
 * `seccion: "fruta"` deja de compilar. Es el error que la llave natural no puede
 * atrapar sola, porque los dos son objetos.
 */
type SavePostcosechaRespuestaInput<S extends PostcosechaSectionId> = {
  plantId: string;
  evalId: string;
  seccion: S;
  payload: PostcosechaFormValues[S];
  /** Cuándo se guardó, en ISO. Lo pone quien llama para no meter reloj aquí. */
  updatedAtLocal: string;
};

/**
 * Las secciones capturadas de una evaluación, para rehidratar el formulario.
 *
 * **Filtra por las dos partes del dueño**: la plantación tiene cuatro
 * evaluaciones y comparten tabla, así que olvidar el `evalId` mezclaría lo de
 * los 15 días con lo de los 30.
 *
 * Una sección que nadie tocó no tiene fila, y eso **no** es lo mismo que una
 * fila con la sección vacía. Quien reconstruya el formulario completa lo que
 * falte con `buildPostcosechaDefaults`.
 */
export const getPostcosechaRespuestas = async (
  db: SQLiteDatabase,
  plantId: string,
  evalId: string,
): Promise<PostcosechaRespuestaRecord[]> => {
  const rows = await db.getAllAsync<PostcosechaRespuestaRow>(
    "SELECT * FROM postcosecha_respuestas WHERE plantId = ? AND evalId = ?",
    [plantId, evalId],
  );

  return rows.map(toRecord);
};

/**
 * Guarda una sección. La vuelve a dejar pendiente y le quita el `syncedAt`:
 * cualquier cambio posterior a la última subida es trabajo que el servidor
 * todavía no tiene.
 *
 * `ON CONFLICT DO UPDATE` y no `INSERT OR REPLACE`: REPLACE borra e inserta, y
 * el día que algo cuelgue de esta tabla se lo llevaría por delante en cada
 * guardado.
 */
export const savePostcosechaRespuesta = async <S extends PostcosechaSectionId>(
  db: SQLiteDatabase,
  {
    plantId,
    evalId,
    seccion,
    payload,
    updatedAtLocal,
  }: SavePostcosechaRespuestaInput<S>,
): Promise<void> => {
  await db.runAsync(
    `INSERT INTO postcosecha_respuestas (plantId, evalId, seccion, payload, syncStatus, updatedAtLocal, syncedAt, hasError, progress)
     VALUES ($plantId, $evalId, $seccion, $payload, $syncStatus, $updatedAtLocal, NULL, $hasError, $progress)
     ON CONFLICT(plantId, evalId, seccion) DO UPDATE SET
       payload = excluded.payload,
       syncStatus = excluded.syncStatus,
       updatedAtLocal = excluded.updatedAtLocal,
       syncedAt = excluded.syncedAt,
       hasError = excluded.hasError,
       progress = excluded.progress`,
    {
      $plantId: plantId,
      $evalId: evalId,
      $seccion: seccion,
      $payload: JSON.stringify(payload),
      $syncStatus: SyncStatus.pending,
      $updatedAtLocal: updatedAtLocal,
      // Los dos derivados se calculan aquí y no los trae quien llama: así no hay
      // forma de escribir una fila cuyo `hasError` o cuyo `progress` no
      // correspondan con su `payload`, que es lo único que hace seguro guardar
      // un dato derivado.
      $hasError: postcosechaSeccionHasError(seccion, payload) ? 1 : 0,
      $progress: formatProgress(postcosechaSeccionProgress(seccion, payload)),
    },
  );
};

/**
 * Borra todo lo capturado de **una** evaluación, no de las cuatro.
 *
 * Borra las filas en vez de dejarlas con el payload vacío, por lo mismo que su
 * hermano: *sin fila* es una sección que nadie tocó, *fila vacía* es una
 * capturada y vaciada, y limpiar significa lo primero.
 *
 * **No toca las fotografías**: viven en `postcosecha_fotos`, ninguna CASCADE las
 * alcanza desde aquí y además hay archivos en disco de por medio. Quien limpia
 * las borra aparte.
 */
export const deletePostcosechaRespuestas = async (
  db: SQLiteDatabase,
  plantId: string,
  evalId: string,
): Promise<void> => {
  await db.runAsync(
    "DELETE FROM postcosecha_respuestas WHERE plantId = ? AND evalId = ?",
    [plantId, evalId],
  );
};

/**
 * Cuánto lleva capturada cada evaluación, de 0 a 1, para las tarjetas del
 * listado. La clave es `plantId:evalId` (`postcosechaKey`).
 *
 * Lee la columna `progress` en vez de abrir payloads: el listado lo pregunta de
 * todas las plantaciones a la vez, y eso es exactamente lo que la columna existe
 * para evitar.
 *
 * Se recorre la **unión** de los dos juegos de claves y no solo las filas: una
 * evaluación con fotografía y sin nada contestado no tiene fila en esta tabla y
 * se quedaría en cero. Es la misma trampa que ya está anotada en
 * `getTratamientoProgress`, y tiene su test.
 *
 * Lo que no aparece en ningún lado no sale en el mapa, y quien lo lea lo cuenta
 * como cero — que es lo correcto: sin capturar es 0 %.
 */
export const getPostcosechaProgress = async (
  db: SQLiteDatabase,
): Promise<Map<string, number>> => {
  const placeholders = POSTCOSECHA_PROGRESS_SECTIONS.map(() => "?").join(",");
  const [rows, fotos] = await Promise.all([
    db.getAllAsync<{ plantId: string; evalId: string; progress: number }>(
      `SELECT plantId, evalId, progress
         FROM postcosecha_respuestas
        WHERE seccion IN (${placeholders})`,
      [...POSTCOSECHA_PROGRESS_SECTIONS],
    ),
    getPostcosechaFotoCategoriaCounts(db),
  ]);

  const secciones = new Map(
    rows.map((row) => [postcosechaKey(row.plantId, row.evalId), row.progress]),
  );
  const claves = new Set([...secciones.keys(), ...fotos.keys()]);

  return new Map(
    [...claves].map((clave) => [
      clave,
      postcosechaProgressFromRow(
        secciones.get(clave) ?? 0,
        fotos.get(clave) ?? 0,
      ),
    ]),
  );
};

/**
 * Las evaluaciones con alguna captura marcada con un dato imposible, por
 * `plantId:evalId` (`postcosechaKey`).
 *
 * SQL puro contra la columna `hasError`: no abre un solo `payload`, igual que su
 * hermana de tratamiento. **Sin índice parcial**, al revés que allí: esta tabla
 * tiene como mucho dos filas por evaluación y cuatro evaluaciones por
 * plantación, así que recorrerla entera no es nada y un índice sería ruido en el
 * esquema. El día que crezca, es un `CREATE INDEX` de una línea sobre
 * `(plantId, evalId) WHERE hasError = 1` — la columna ya está al día, así que no
 * necesitaría backfill.
 */
export const getPostcosechaIdsWithErrors = async (
  db: SQLiteDatabase,
): Promise<Set<string>> => {
  const rows = await db.getAllAsync<{ plantId: string; evalId: string }>(
    "SELECT DISTINCT plantId, evalId FROM postcosecha_respuestas WHERE hasError = 1",
  );

  return new Set(rows.map((row) => postcosechaKey(row.plantId, row.evalId)));
};
