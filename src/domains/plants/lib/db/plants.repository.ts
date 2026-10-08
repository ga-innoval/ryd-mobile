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
 * Las plantaciones con algo capturado que todavía no ha salido de la tablet.
 *
 * Mira las **cuatro** tablas de captura, porque el evaluador no distingue entre
 * ellas: lo que pregunta es «¿me falta mandar algo de esta plantación?». Las dos
 * de tratamiento pasan por `tratamientos` para llegar al `plantId`; las dos de
 * post-cosecha ya lo llevan.
 *
 * Es SQL contra `syncStatus` y no abre un solo payload, igual que
 * `getTratamientoIdsWithErrors`: el listado lo pregunta de todas las
 * plantaciones a la vez. Los índices parciales de la v10 son los que lo hacen
 * barato — dentro de ellos solo hay filas pendientes.
 *
 * Vive aquí y no en los repositorios de captura porque la respuesta está
 * **llaveada por plantación**, y porque es lo que `isSafeToDelete` necesita el
 * día que deje de ser un guard de adorno.
 *
 * `rejected_closed` no cuenta como pendiente: no hay nada que reintentar hasta
 * que la encuesta se reabra, y contarlo dejaría la tarjeta en «Pendiente» para
 * siempre sin que nadie pudiera quitarlo.
 */
export const getPlantIdsWithPendingWork = async (
  db: SQLiteDatabase,
): Promise<Set<string>> => {
  const rows = await db.getAllAsync<{ plantId: string }>(
    `SELECT t.plantId AS plantId
       FROM respuestas r
       JOIN tratamientos t ON t.id = r.tratamientoId
      WHERE r.syncStatus = ?
      UNION
     SELECT t.plantId AS plantId
       FROM respuesta_fotos f
       JOIN tratamientos t ON t.id = f.tratamientoId
      WHERE f.syncStatus = ?
      UNION
     SELECT plantId FROM postcosecha_respuestas WHERE syncStatus = ?
      UNION
     SELECT plantId FROM postcosecha_fotos WHERE syncStatus = ?`,
    [
      SyncStatus.pending,
      SyncStatus.pending,
      SyncStatus.pending,
      SyncStatus.pending,
    ],
  );

  return new Set(rows.map((row) => row.plantId));
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
