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
 * Si a la plantación le queda algo que el servidor todavía no tiene, de
 * cualquiera de sus cuatro tablas.
 *
 * **Lo que protege de la poda de la descarga.** Al desactivarse en remoto, la
 * plantación se borra y la CASCADE arrasa con sus tratamientos, sus respuestas y
 * sus fotografías — las cuatro tablas cuelgan de aquí.
 *
 * «Sin sincronizar» es todo lo que no esté `synced`, `rejected_closed` incluido:
 * esa fila está esperando a que un administrador reabra la encuesta, y borrarla
 * sería tirar justo el dato que el rechazo prometía conservar.
 *
 * Una pregunta por plantación y no el conjunto de todas, al revés que los
 * lectores del listado: esto se pregunta solo de las que se van a borrar, que
 * son las pocas que el pull trajo inutilizables.
 */
export const hasUnsyncedWorkForPlant = async (
  db: SQLiteDatabase,
  plantId: string,
): Promise<boolean> => {
  const row = await db.getFirstAsync<{ pendiente: number }>(
    `SELECT EXISTS(
       SELECT 1 FROM respuestas r
         JOIN tratamientos t ON t.id = r.tratamientoId
        WHERE t.plantId = $id AND r.syncStatus <> $synced
       UNION ALL
       SELECT 1 FROM respuesta_fotos f
         JOIN tratamientos t ON t.id = f.tratamientoId
        WHERE t.plantId = $id AND f.syncStatus <> $synced
       UNION ALL
       SELECT 1 FROM postcosecha_respuestas
        WHERE plantId = $id AND syncStatus <> $synced
       UNION ALL
       SELECT 1 FROM postcosecha_fotos
        WHERE plantId = $id AND syncStatus <> $synced
     ) AS pendiente`,
    { $id: plantId, $synced: SyncStatus.synced },
  );

  return (row?.pendiente ?? 0) === 1;
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
 * Solo se borra lo que no deja trabajo sin mandar. Si quedó captura local, la
 * plantación se conserva: el remoto rechaza actualizaciones mientras
 * `is_active = false`, así que debe sobrevivir hasta que la reactiven (al
 * reactivarla cambia `updated_at` y vuelve en el pull).
 *
 * **Hasta ahora era un guard de adorno**: miraba `syncStatus`, que es el estado
 * de la plantación en el *pull* y que `mapRemotePlant` escribe siempre como
 * `synced`, así que nunca impedía nada. Daba igual mientras no hubiera captura
 * local; con la sincronización en marcha pasan días entre capturar y mandar, y
 * un borrado aquí es trabajo de campo que no se puede repetir.
 *
 * Conservar sin más, sin marca ni aviso: es estrictamente mejor que perder el
 * dato y no necesita decidir cómo se vería una plantación retenida. Esa decisión
 * sigue abierta.
 */
const isSafeToDelete = async (db: SQLiteDatabase, plantId: string) =>
  !(await hasUnsyncedWorkForPlant(db, plantId));

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
      if (await isSafeToDelete(db, entry.plant.id)) {
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
