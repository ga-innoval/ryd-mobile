import type { SQLiteDatabase } from "expo-sqlite";
import { SyncStatus } from "../../types";

/**
 * Una fotografía de post-cosecha tal como se guarda: su ficha, no el archivo.
 *
 * Hermana de `respuesta-fotos.repository.ts` y con las mismas reglas —`fileName`
 * y nunca la ruta, cero `expo-file-system` aquí para que los tests corran contra
 * SQLite de verdad—. Lo que cambia es el dueño: allí un tratamiento, aquí la
 * plantación más cuál de las cuatro evaluaciones.
 */
export type PostcosechaFotoRecord = {
  /** El UUID que viaja al servidor; también da nombre al archivo. */
  clientId: string;
  plantId: string;
  /** Cuál de `EVALS_POST_COSECHA`: `15caja`, `30plastico`… */
  evalId: string;
  categoria: string;
  /** Cuándo se capturó, en ISO. Es el orden de la cuadrícula. */
  capturedAt: string;
  fileName: string;
  syncStatus: SyncStatus;
  syncedAt: string | null;
};

type PostcosechaFotoRow = Omit<PostcosechaFotoRecord, "syncStatus"> & {
  syncStatus: string;
};

type InsertInput = Omit<PostcosechaFotoRecord, "syncStatus" | "syncedAt">;

const toRecord = (row: PostcosechaFotoRow): PostcosechaFotoRecord => ({
  ...row,
  syncStatus: row.syncStatus as SyncStatus,
});

/**
 * Las de una evaluación, en el orden en que se capturaron.
 *
 * El desempate por `rowid` no es adorno: elegir varias de la galería inserta N
 * filas en un bucle y varias caen en el mismo milisegundo. Sin él, «la última
 * capturada» que enseña el resumen de la fila sería arbitraria dentro del lote.
 */
export const getPostcosechaFotos = async (
  db: SQLiteDatabase,
  plantId: string,
  evalId: string,
): Promise<PostcosechaFotoRecord[]> => {
  const rows = await db.getAllAsync<PostcosechaFotoRow>(
    `SELECT * FROM postcosecha_fotos
      WHERE plantId = ? AND evalId = ?
      ORDER BY capturedAt ASC, rowid ASC`,
    [plantId, evalId],
  );

  return rows.map(toRecord);
};

export const insertPostcosechaFoto = async (
  db: SQLiteDatabase,
  { clientId, plantId, evalId, categoria, fileName, capturedAt }: InsertInput,
): Promise<void> => {
  await db.runAsync(
    `INSERT INTO postcosecha_fotos (clientId, plantId, evalId, categoria, fileName, capturedAt, syncStatus, syncedAt)
     VALUES ($clientId, $plantId, $evalId, $categoria, $fileName, $capturedAt, $syncStatus, NULL)
     ON CONFLICT(clientId) DO NOTHING`,
    {
      $clientId: clientId,
      $plantId: plantId,
      $evalId: evalId,
      $categoria: categoria,
      $fileName: fileName,
      $capturedAt: capturedAt,
      $syncStatus: SyncStatus.pending,
    },
  );
};

/**
 * Los nombres de archivo de esos ids.
 *
 * Existe porque el borrado va en dos pasos —fila primero, archivo después— y
 * después del `DELETE` ya no hay de dónde sacar el nombre.
 */
export const getPostcosechaFotoFileNames = async (
  db: SQLiteDatabase,
  clientIds: readonly string[],
): Promise<string[]> => {
  if (clientIds.length === 0) return [];

  const placeholders = clientIds.map(() => "?").join(",");
  const rows = await db.getAllAsync<{ fileName: string }>(
    `SELECT fileName FROM postcosecha_fotos WHERE clientId IN (${placeholders})`,
    [...clientIds],
  );

  return rows.map((row) => row.fileName);
};

export const deletePostcosechaFotos = async (
  db: SQLiteDatabase,
  clientIds: readonly string[],
): Promise<void> => {
  if (clientIds.length === 0) return;

  const placeholders = clientIds.map(() => "?").join(",");
  await db.runAsync(
    `DELETE FROM postcosecha_fotos WHERE clientId IN (${placeholders})`,
    [...clientIds],
  );
};

/**
 * Los nombres de todo lo que sigue vivo, para la barrida de huérfanos.
 *
 * **La barrida tiene que unir esto con lo de `respuesta_fotos`**: los archivos
 * de las dos tablas comparten carpeta, así que mirar solo una borraría las de la
 * otra. Hay un test que lo fija.
 */
export const getAllPostcosechaFotoFileNames = async (
  db: SQLiteDatabase,
): Promise<Set<string>> => {
  const rows = await db.getAllAsync<{ fileName: string }>(
    "SELECT fileName FROM postcosecha_fotos",
  );

  return new Set(rows.map((row) => row.fileName));
};
