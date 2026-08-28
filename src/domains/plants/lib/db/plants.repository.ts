import type { SQLiteDatabase } from "expo-sqlite";
import { PlantRecord } from "../../types";

export const getAllPlants = async (
  db: SQLiteDatabase,
): Promise<PlantRecord[]> => {
  return db.getAllAsync<PlantRecord>("SELECT * FROM plants ORDER BY name ASC");
};

export const getPlantById = async (
  db: SQLiteDatabase,
  id: string,
): Promise<PlantRecord | null> => {
  return db.getFirstAsync<PlantRecord>("SELECT * FROM plants WHERE id = ?", [
    id,
  ]);
};

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

export const upsertPlantsBatch = async (
  db: SQLiteDatabase,
  plants: PlantRecord[],
): Promise<void> => {
  await db.withTransactionAsync(async () => {
    for (const plant of plants) {
      await upsertPlant(db, plant);
    }
  });
};

export const deleteAllPlants = async (db: SQLiteDatabase): Promise<void> => {
  await db.runAsync("DELETE FROM plants");
};
