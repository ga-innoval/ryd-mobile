import type { SQLiteDatabase } from "expo-sqlite";
import { SyncStatus } from "../../types";
import { PHOTO_CATEGORIES } from "../photo-categories";

/**
 * Una fotografía de evidencia tal como se guarda: su ficha, no el archivo.
 *
 * `fileName` es solo el nombre; la ruta la reconstruye `lib/photo-files.ts`.
 * Guardarla entera no serviría: el contenedor de la app cambia de UUID entre
 * instalaciones en iOS.
 *
 * Nada de esto importa `expo-file-system` a propósito: aquí solo hay SQL, y así
 * los tests corren contra SQLite de verdad sin mockear el módulo nativo.
 */
export type RespuestaFotoRecord = {
  /** El UUID que viaja al servidor; también da nombre al archivo. */
  clientId: string;
  tratamientoId: string;
  categoria: string;
  fileName: string;
  /** Cuándo se capturó, en ISO. Es el orden de la cuadrícula. */
  capturedAt: string;
  syncStatus: SyncStatus;
  syncedAt: string | null;
};

type RespuestaFotoRow = Omit<RespuestaFotoRecord, "syncStatus"> & {
  syncStatus: string;
};

type InsertFotoInput = Omit<RespuestaFotoRecord, "syncStatus" | "syncedAt">;

const toRecord = (row: RespuestaFotoRow): RespuestaFotoRecord => ({
  ...row,
  syncStatus: row.syncStatus as SyncStatus,
});

/**
 * Las de un tratamiento, en el orden en que se capturaron.
 *
 * Las tres tomas de una vez y no una consulta por categoría: la sección las
 * necesita juntas y la cuadrícula filtra la suya, así que una sola clave de
 * caché sirve a las dos pantallas.
 *
 * El desempate por `rowid` no es adorno: elegir varias de la galería inserta N
 * filas en un bucle y varias caen en el mismo milisegundo. Sin él, «la última
 * capturada» que enseña el resumen de la fila sería arbitraria dentro del lote.
 */
export const getFotosByTratamiento = async (
  db: SQLiteDatabase,
  tratamientoId: string,
): Promise<RespuestaFotoRecord[]> => {
  const rows = await db.getAllAsync<RespuestaFotoRow>(
    `SELECT * FROM respuesta_fotos
      WHERE tratamientoId = ?
      ORDER BY capturedAt ASC, rowid ASC`,
    [tratamientoId],
  );

  return rows.map(toRecord);
};

export const insertFoto = async (
  db: SQLiteDatabase,
  { clientId, tratamientoId, categoria, fileName, capturedAt }: InsertFotoInput,
): Promise<void> => {
  await db.runAsync(
    `INSERT INTO respuesta_fotos (clientId, tratamientoId, categoria, fileName, capturedAt, syncStatus, syncedAt)
     VALUES ($clientId, $tratamientoId, $categoria, $fileName, $capturedAt, $syncStatus, NULL)
     ON CONFLICT(clientId) DO NOTHING`,
    {
      $clientId: clientId,
      $tratamientoId: tratamientoId,
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
 * después del `DELETE` ya no hay de dónde sacar el nombre. Un `DELETE …
 * RETURNING` sería más corto, pero `runAsync` descarta las filas devueltas y
 * quedaría sin test.
 */
export const getFotoFileNames = async (
  db: SQLiteDatabase,
  clientIds: readonly string[],
): Promise<string[]> => {
  if (clientIds.length === 0) return [];

  const placeholders = clientIds.map(() => "?").join(",");
  const rows = await db.getAllAsync<{ fileName: string }>(
    `SELECT fileName FROM respuesta_fotos WHERE clientId IN (${placeholders})`,
    [...clientIds],
  );

  return rows.map((row) => row.fileName);
};

/** En lote y en una sentencia: los ids no se desplazan como los índices, pero
 *  una sola escritura sigue siendo una sola invalidación. */
export const deleteFotos = async (
  db: SQLiteDatabase,
  clientIds: readonly string[],
): Promise<void> => {
  if (clientIds.length === 0) return;

  const placeholders = clientIds.map(() => "?").join(",");
  await db.runAsync(
    `DELETE FROM respuesta_fotos WHERE clientId IN (${placeholders})`,
    [...clientIds],
  );
};

/**
 * Cuántas tomas del catálogo llevan al menos una fotografía, por tratamiento.
 *
 * Es el sexto de fotografías del avance, resuelto en SQL: un `COUNT` que no
 * abre ningún archivo ni ningún payload. Filtra por el catálogo igual que
 * `summarizePhotoCategories`, para que una categoría retirada no siga contando.
 */
export const getFotoCategoriaCounts = async (
  db: SQLiteDatabase,
): Promise<Map<string, number>> => {
  const placeholders = PHOTO_CATEGORIES.map(() => "?").join(",");
  const rows = await db.getAllAsync<{
    tratamientoId: string;
    categorias: number;
  }>(
    `SELECT tratamientoId, COUNT(DISTINCT categoria) AS categorias
       FROM respuesta_fotos
      WHERE categoria IN (${placeholders})
      GROUP BY tratamientoId`,
    PHOTO_CATEGORIES.map((category) => category.id),
  );

  return new Map(rows.map((row) => [row.tratamientoId, row.categorias]));
};

/** Los nombres de todo lo que sigue vivo, para la barrida de huérfanos. */
export const getAllFotoFileNames = async (
  db: SQLiteDatabase,
): Promise<Set<string>> => {
  const rows = await db.getAllAsync<{ fileName: string }>(
    "SELECT fileName FROM respuesta_fotos",
  );

  return new Set(rows.map((row) => row.fileName));
};
