import type { SQLiteDatabase } from "expo-sqlite";
import type { TratamientoRecord } from "../../types";

// La fila tal como vive en SQLite: no hay BOOLEAN, los booleanos son 0/1.
type TratamientoRow = Omit<TratamientoRecord, "isActive"> & {
  isActive: number;
};

const toRecord = (row: TratamientoRow): TratamientoRecord => ({
  ...row,
  isActive: Boolean(row.isActive),
});

export const upsertTratamiento = async (
  db: SQLiteDatabase,
  tratamiento: TratamientoRecord,
): Promise<void> => {
  await db.runAsync(
    `INSERT INTO tratamientos (id, plantId, name, description, temporada, isActive)
     VALUES ($id, $plantId, $name, $description, $temporada, $isActive)
     ON CONFLICT(id) DO UPDATE SET
       plantId = excluded.plantId,
       name = excluded.name,
       description = excluded.description,
       temporada = excluded.temporada,
       isActive = excluded.isActive`,
    {
      $id: tratamiento.id,
      $plantId: tratamiento.plantId,
      $name: tratamiento.name,
      $description: tratamiento.description,
      $temporada: tratamiento.temporada,
      $isActive: tratamiento.isActive ? 1 : 0,
    },
  );
};

export const deleteTratamiento = async (
  db: SQLiteDatabase,
  id: string,
): Promise<void> => {
  await db.runAsync("DELETE FROM tratamientos WHERE id = ?", [id]);
};

/**
 * Converge los tratamientos de una plantación con lo que mandó el servidor.
 *
 * No hace falta reconciliar por ausencia: el backend manda la lista completa
 * incluyendo los dados de baja, con `isActive: false` como lápida explícita.
 *
 * TODO(respuestas): cuando exista la tabla, un inactivo con respuestas sin
 * sincronizar debe conservarse (marcado) en vez de podarse — el remoto no
 * acepta actualizaciones mientras esté inactivo. Hoy no hay nada que retener.
 * Ese mismo día hay que revisar la CASCADE de esta tabla: borrar un
 * tratamiento con respuestas capturadas las destruiría.
 */
export const syncPlantTratamientos = async (
  db: SQLiteDatabase,
  tratamientos: TratamientoRecord[],
): Promise<void> => {
  for (const tratamiento of tratamientos) {
    if (tratamiento.isActive) {
      await upsertTratamiento(db, tratamiento);
    } else {
      await deleteTratamiento(db, tratamiento.id);
    }
  }
};

export const getAllTratamientos = async (
  db: SQLiteDatabase,
): Promise<TratamientoRecord[]> => {
  const rows = await db.getAllAsync<TratamientoRow>(
    `SELECT * FROM tratamientos
      WHERE isActive = 1
      ORDER BY temporada DESC, name ASC`,
  );

  return rows.map(toRecord);
};
