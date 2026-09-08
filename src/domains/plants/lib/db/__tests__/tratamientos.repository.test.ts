import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import { buildTratamiento } from "@/test-utils/factories/tratamiento.factory";
import type { PlantRecord } from "../../../types";
import { upsertPlant } from "../plants.repository";
import {
  getAllTratamientos,
  getTratamientoById,
  upsertTratamiento,
} from "../tratamientos.repository";

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

describe("getTratamientoById", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = createInMemoryDb();
    await runMigrations(db);
    await upsertPlant(db, buildRecord({ id: "p1" }));
  });

  it("devuelve el tratamiento con sus campos mapeados", async () => {
    await upsertTratamiento(
      db,
      buildTratamiento({ id: "t1", plantId: "p1", name: "Azul" }),
    );

    expect(await getTratamientoById(db, "t1")).toMatchObject({
      id: "t1",
      plantId: "p1",
      name: "Azul",
      isActive: true,
    });
  });

  it("devuelve null cuando no existe", async () => {
    expect(await getTratamientoById(db, "desconocido")).toBeNull();
  });

  it("devuelve también los inactivos, a diferencia de getAllTratamientos", async () => {
    // La diferencia es deliberada: el listado no debe mostrar lápidas, pero
    // una búsqueda por id sí tiene que poder abrirlas.
    await upsertTratamiento(
      db,
      buildTratamiento({ id: "baja", plantId: "p1", isActive: false }),
    );

    expect(await getTratamientoById(db, "baja")).toMatchObject({
      id: "baja",
      isActive: false,
    });
    expect(await getAllTratamientos(db)).toHaveLength(0);
  });
});
