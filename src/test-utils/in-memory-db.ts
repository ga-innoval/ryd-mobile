import { DatabaseSync } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

type Params = unknown[] | Record<string, unknown> | undefined;

const asArgs = (params: Params): unknown[] => {
  if (params === undefined) return [];
  return Array.isArray(params) ? params : [params];
};

/**
 * Adaptador mínimo de `node:sqlite` (built-in de Node, sin dependencias
 * nuevas) a la superficie de `SQLiteDatabase` que usan los repositorios.
 *
 * Existe para poder probar el SQL de verdad —CASCADE, ON CONFLICT, el
 * upsert— en vez de mockear el módulo nativo, que no probaría nada.
 *
 * Ojo: `DatabaseSync` activa las foreign keys por defecto, así que estos
 * tests verifican que la CASCADE está bien declarada, NO que el
 * `PRAGMA foreign_keys = ON` de `runMigrations` esté en el lugar correcto.
 * Eso solo se comprueba en dispositivo.
 */
export const createInMemoryDb = (): SQLiteDatabase => {
  const db = new DatabaseSync(":memory:");

  const adapter = {
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    runAsync: async (sql: string, params?: Params) => {
      db.prepare(sql).run(...asArgs(params));
    },
    getAllAsync: async (sql: string, params?: Params) =>
      db.prepare(sql).all(...asArgs(params)),
    getFirstAsync: async (sql: string, params?: Params) =>
      db.prepare(sql).get(...asArgs(params)) ?? null,
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec("BEGIN");
      try {
        await task();
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };

  // El adaptador cubre solo lo que los repositorios usan, no toda la
  // interfaz de expo-sqlite.
  return adapter as unknown as SQLiteDatabase;
};
