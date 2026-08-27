import type { SQLiteDatabase } from "expo-sqlite";

const DATABASE_VERSION = 1;

export async function runMigrations(db: SQLiteDatabase) {
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

  // Próxima migración. ej:
  // if (currentVersion === 1) {
  //   await db.execAsync(`CREATE TABLE IF NOT EXISTS newTable (...)`);
  //   currentVersion = 2;
  // }

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}
