import type { SQLiteDatabase } from "expo-sqlite";
import {
  PlantRecord,
  PlantSyncEntry,
  PlantWithTratamientos,
  SyncStatus,
} from "../../types";
import { attachTratamientos } from "../attach-tratamientos";
import {
  getAllTratamientos,
  syncPlantTratamientos,
} from "./tratamientos.repository";

export const getAllPlants = async (
  db: SQLiteDatabase,
): Promise<PlantWithTratamientos[]> => {
  const plants = await db.getAllAsync<PlantRecord>(
    "SELECT * FROM plants ORDER BY name ASC",
  );
  const tratamientos = await getAllTratamientos(db);

  return attachTratamientos(plants, tratamientos);
};

export const getPlantById = async (
  db: SQLiteDatabase,
  id: string,
): Promise<PlantRecord | null> => {
  return db.getFirstAsync<PlantRecord>("SELECT * FROM plants WHERE id = ?", [
    id,
  ]);
};

/**
 * `ON CONFLICT DO UPDATE` no es preferencia de estilo, es invariante de
 * corrección: con `foreign_keys = ON`, un `INSERT OR REPLACE` haría
 * DELETE + INSERT, dispararía la CASCADE de `tratamientos` y los borraría en
 * cada sincronización.
 */
export const upsertPlant = async (
  db: SQLiteDatabase,
  plant: PlantRecord,
): Promise<void> => {
  await db.runAsync(
    `INSERT INTO plants (id, name, campo, cuadro, programa, portainjerto, anio, syncStatus)
     VALUES ($id, $name, $campo, $cuadro, $programa, $portainjerto, $anio, $syncStatus)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       campo = excluded.campo,
       cuadro = excluded.cuadro,
       programa = excluded.programa,
       portainjerto = excluded.portainjerto,
       anio = excluded.anio,
       syncStatus = excluded.syncStatus`,
    {
      $id: plant.id,
      $name: plant.name,
      $campo: plant.campo,
      $cuadro: plant.cuadro,
      $programa: plant.programa,
      $portainjerto: plant.portainjerto,
      $anio: plant.anio,
      $syncStatus: plant.syncStatus,
    },
  );
};

export const deletePlant = async (
  db: SQLiteDatabase,
  id: string,
): Promise<void> => {
  // La CASCADE se lleva sus tratamientos.
  await db.runAsync("DELETE FROM plants WHERE id = ?", [id]);
};

/**
 * Solo se borra lo que está completamente sincronizado. Si quedó captura
 * local, la plantación se conserva: el remoto rechaza actualizaciones mientras
 * `is_active = false`, así que debe sobrevivir hasta que la reactiven (al
 * reactivarla cambia `updated_at` y vuelve en el pull).
 *
 * TODO(respuestas): cuando exista la tabla, esto debe mirar las respuestas sin
 * sincronizar de la plantación. Hoy `mapRemotePlant` siempre escribe `synced`,
 * así que este guard nunca impide un borrado — y es correcto, porque todavía
 * no hay captura local que proteger.
 */
const isSafeToDelete = (local: PlantRecord | null) =>
  local === null || local.syncStatus === SyncStatus.synced;

/**
 * Una plantación sin tratamientos activos no se puede usar en la app.
 * Se revisa `isActive` de cada tratamiento y no `length`, porque el
 * array incluye tratamientos con `isActive = false`
 */
const isUsable = (entry: PlantSyncEntry) =>
  entry.isActive && entry.tratamientos.some((t) => t.isActive);

/**
 * Devuelve cuántas plantaciones quedaron almacenadas, que no tiene por qué ser
 * `entries.length`: la regla de arriba descarta las inutilizables, y quien la
 * aplica es quien puede contarlas.
 */
export const syncPlantsBatch = async (
  db: SQLiteDatabase,
  entries: PlantSyncEntry[],
): Promise<number> => {
  let stored = 0;

  await db.withTransactionAsync(async () => {
    for (const entry of entries) {
      if (isUsable(entry)) {
        await upsertPlant(db, entry.plant);
        await syncPlantTratamientos(db, entry.plant.id, entry.tratamientos);
        stored += 1;
        continue;
      }

      // Desactivada o sin tratamientos usables: el desenlace es el mismo.
      if (isSafeToDelete(await getPlantById(db, entry.plant.id))) {
        await deletePlant(db, entry.plant.id);
      }
    }
  });

  return stored;
};

export const deleteAllPlants = async (db: SQLiteDatabase): Promise<void> => {
  // Con `foreign_keys = ON`, la CASCADE vacía también `tratamientos`.
  await db.runAsync("DELETE FROM plants");
};
