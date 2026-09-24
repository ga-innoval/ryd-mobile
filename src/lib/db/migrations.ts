import type { SQLiteDatabase } from "expo-sqlite";

const DATABASE_VERSION = 3;

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

  if (currentVersion === 2) {
    // Una fila por sección capturada, y no una por evaluación: la evaluación
    // vive semanas —los cortes de rendimiento son de días distintos—, así que
    // lo terminado se sincroniza sin arrastrar lo que falta. Sin fila no es lo
    // mismo que fila vacía: la sección que nadie tocó no existe.
    //
    // La PK es la llave natural y no un UUID: las dos partes ya existen en los
    // dos lados antes del primer envío, así que un reenvío no puede duplicar.
    //
    // `payload` es el JSON de la sección tal como se capturó (texto, no
    // números): al reabrir la pantalla hay que enseñar exactamente lo tecleado.
    // El contrato con el backend está en `docs/contrato-respuestas.md`.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS respuestas (
        tratamientoId TEXT NOT NULL,
        seccion TEXT NOT NULL,
        payload TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'pending',
        updatedAtLocal TEXT NOT NULL,
        syncedAt TEXT,
        PRIMARY KEY (tratamientoId, seccion),
        FOREIGN KEY (tratamientoId) REFERENCES tratamientos(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_respuestas_syncStatus
        ON respuestas(syncStatus);
    `);
    currentVersion = 3;
  }

  // Próxima migración. ej:
  // if (currentVersion === 3) {
  //   await db.execAsync(`CREATE TABLE IF NOT EXISTS newTable (...)`);
  //   currentVersion = 4;
  // }

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}
