import type { SQLiteDatabase } from "expo-sqlite";

const DATABASE_VERSION = 2;

export async function runMigrations(db: SQLiteDatabase) {
  await db.execAsync("PRAGMA foreign_keys = ON");

  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  let currentVersion = row?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) return;

  await db.execAsync("PRAGMA journal_mode = WAL");

  if (currentVersion === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS plants (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        campo TEXT NOT NULL,
        cuadro TEXT NOT NULL,
        programa TEXT NOT NULL,
        portainjerto TEXT NOT NULL,
        anio INTEGER NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'synced'
      );
    `);
    currentVersion = 1;
  }

  if (currentVersion === 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS tratamientos (
        id TEXT PRIMARY KEY NOT NULL,
        plantId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        temporada INTEGER NOT NULL,
        isActive INTEGER NOT NULL,
        FOREIGN KEY (plantId) REFERENCES plants(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_tratamientos_plantId
        ON tratamientos(plantId);
    `);
    currentVersion = 2;
  }

  // Próxima migración. ej:
  // if (currentVersion === 2) {
  //   await db.execAsync(`CREATE TABLE IF NOT EXISTS newTable (...)`);
  //   currentVersion = 3;
  // }

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}
