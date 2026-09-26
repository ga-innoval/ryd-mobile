import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "../migrations";

/** Lo que devuelve `PRAGMA synchronous`: 1 es NORMAL, 2 es FULL. */
const SYNCHRONOUS_FULL = 2;
const SYNCHRONOUS_NORMAL = 1;

const synchronousDe = async (db: SQLiteDatabase) =>
  (await db.getFirstAsync<{ synchronous: number }>("PRAGMA synchronous"))
    ?.synchronous;

describe("runMigrations", () => {
  let db: SQLiteDatabase;

  beforeEach(() => {
    db = createInMemoryDb();
  });

  /**
   * `synchronous` es por conexión y **no persiste**, así que tiene que quedar
   * por encima del early-return: si se pusiera junto a `journal_mode`, las
   * tablets que ya están en la última versión abrirían la base sin él.
   *
   * Por eso el escenario es una instalación **ya migrada**: con `user_version`
   * alto, `runMigrations` se sale antes de tocar nada, y lo único que puede
   * dejar el `synchronous` en su sitio es que se fije arriba del todo. Mover esa
   * línea abajo pone este test en rojo.
   *
   * Ojo al montarlo: el default de `node:sqlite` ya es FULL, así que hay que
   * bajarlo a mano primero o el test pasaría sin comprobar nada.
   */
  it("fija synchronous aunque no haya nada que migrar", async () => {
    await db.execAsync(`PRAGMA synchronous = NORMAL; PRAGMA user_version = 999`);
    expect(await synchronousDe(db)).toBe(SYNCHRONOUS_NORMAL);

    await runMigrations(db);

    expect(await synchronousDe(db)).toBe(SYNCHRONOUS_FULL);
  });

  it("lo fija también en una instalación nueva", async () => {
    await db.execAsync("PRAGMA synchronous = NORMAL");

    await runMigrations(db);

    expect(await synchronousDe(db)).toBe(SYNCHRONOUS_FULL);
  });
});
