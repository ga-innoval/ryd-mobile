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
  getTratamientosByPlantId,
  upsertTratamiento,
} from "../tratamientos.repository";

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

describe("getTratamientosByPlantId", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = createInMemoryDb();
    await runMigrations(db);
    await upsertPlant(db, buildRecord({ id: "p1" }));
    await upsertPlant(db, buildRecord({ id: "p2" }));
  });

  it("devuelve solo los de esa plantación", async () => {
    await upsertTratamiento(db, buildTratamiento({ id: "a", plantId: "p1" }));
    await upsertTratamiento(db, buildTratamiento({ id: "b", plantId: "p2" }));

    expect(
      (await getTratamientosByPlantId(db, "p1")).map((t) => t.id),
    ).toEqual(["a"]);
  });

  it("excluye los dados de baja", async () => {
    await upsertTratamiento(db, buildTratamiento({ id: "vivo", plantId: "p1" }));
    await upsertTratamiento(
      db,
      buildTratamiento({ id: "baja", plantId: "p1", isActive: false }),
    );

    expect(
      (await getTratamientosByPlantId(db, "p1")).map((t) => t.id),
    ).toEqual(["vivo"]);
  });

  it("ordena por temporada descendente y luego por nombre", async () => {
    await upsertTratamiento(
      db,
      buildTratamiento({ id: "a", plantId: "p1", name: "Zeta", temporada: 2025 }),
    );
    await upsertTratamiento(
      db,
      buildTratamiento({ id: "b", plantId: "p1", name: "Beta", temporada: 2026 }),
    );
    await upsertTratamiento(
      db,
      buildTratamiento({ id: "c", plantId: "p1", name: "Alfa", temporada: 2026 }),
    );

    expect(
      (await getTratamientosByPlantId(db, "p1")).map((t) => t.name),
    ).toEqual(["Alfa", "Beta", "Zeta"]);
  });
});

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
