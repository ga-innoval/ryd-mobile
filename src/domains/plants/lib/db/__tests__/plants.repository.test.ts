import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import { buildTratamiento } from "@/test-utils/factories/tratamiento.factory";
import {
  SyncStatus,
  type PlantRecord,
  type PlantSyncEntry,
} from "../../../types";
import { getAllPlants, syncPlantsBatch } from "../plants.repository";

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

const buildEntry = (
  overrides: Partial<PlantSyncEntry> = {},
): PlantSyncEntry => ({
  plant: buildRecord({ id: "p1", syncStatus: SyncStatus.synced }),
  tratamientos: [],
  isActive: true,
  ...overrides,
});

const tratamientosOf = async (db: SQLiteDatabase, plantId: string) => {
  const plants = await getAllPlants(db);
  return plants.find((p) => p.id === plantId)?.tratamientos ?? [];
};

describe("syncPlantsBatch", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = createInMemoryDb();
    await runMigrations(db);
  });

  it("guarda la plantación con sus tratamientos en la primera descarga", async () => {
    await syncPlantsBatch(db, [
      buildEntry({
        tratamientos: [
          buildTratamiento({ id: "t1", plantId: "p1" }),
          buildTratamiento({ id: "t2", plantId: "p1" }),
        ],
      }),
    ]);

    expect(await tratamientosOf(db, "p1")).toHaveLength(2);
  });

  it("incorpora un tratamiento nuevo sin tocar el encabezado", async () => {
    // El caso que motiva la feature: hoy 2, mañana 3.
    await syncPlantsBatch(db, [
      buildEntry({
        tratamientos: [
          buildTratamiento({ id: "t1", plantId: "p1" }),
          buildTratamiento({ id: "t2", plantId: "p1" }),
        ],
      }),
    ]);

    await syncPlantsBatch(db, [
      buildEntry({
        tratamientos: [
          buildTratamiento({ id: "t1", plantId: "p1" }),
          buildTratamiento({ id: "t2", plantId: "p1" }),
          buildTratamiento({ id: "t3", plantId: "p1" }),
        ],
      }),
    ]);

    expect((await tratamientosOf(db, "p1")).map((t) => t.id).sort()).toEqual([
      "t1",
      "t2",
      "t3",
    ]);
  });

  it("poda el tratamiento dado de baja sin tocar los de otra plantación", async () => {
    await syncPlantsBatch(db, [
      buildEntry({
        tratamientos: [
          buildTratamiento({ id: "t1", plantId: "p1" }),
          buildTratamiento({ id: "t2", plantId: "p1" }),
        ],
      }),
      buildEntry({
        plant: buildRecord({ id: "p2", syncStatus: SyncStatus.synced }),
        tratamientos: [buildTratamiento({ id: "t3", plantId: "p2" })],
      }),
    ]);

    await syncPlantsBatch(db, [
      buildEntry({
        tratamientos: [
          buildTratamiento({ id: "t1", plantId: "p1" }),
          buildTratamiento({ id: "t2", plantId: "p1", isActive: false }),
        ],
      }),
    ]);

    expect((await tratamientosOf(db, "p1")).map((t) => t.id)).toEqual(["t1"]);
    expect((await tratamientosOf(db, "p2")).map((t) => t.id)).toEqual(["t3"]);
  });

  it("actualiza los datos de un tratamiento que ya existía", async () => {
    await syncPlantsBatch(db, [
      buildEntry({
        tratamientos: [buildTratamiento({ id: "t1", plantId: "p1" })],
      }),
    ]);

    await syncPlantsBatch(db, [
      buildEntry({
        tratamientos: [
          buildTratamiento({ id: "t1", plantId: "p1", name: "Renombrado" }),
        ],
      }),
    ]);

    const tratamientos = await tratamientosOf(db, "p1");
    expect(tratamientos).toHaveLength(1);
    expect(tratamientos[0].name).toBe("Renombrado");
  });

  it("re-sincronizar la plantación no borra sus tratamientos", async () => {
    // Si `upsertPlant` usara INSERT OR REPLACE, la CASCADE los borraría aquí.
    await syncPlantsBatch(db, [
      buildEntry({
        tratamientos: [buildTratamiento({ id: "t1", plantId: "p1" })],
      }),
    ]);

    await syncPlantsBatch(db, [
      buildEntry({
        plant: buildRecord({
          id: "p1",
          campo: "Otro campo",
          syncStatus: SyncStatus.synced,
        }),
        tratamientos: [buildTratamiento({ id: "t1", plantId: "p1" })],
      }),
    ]);

    expect(await tratamientosOf(db, "p1")).toHaveLength(1);
  });

  it("borra la plantación desactivada y sus tratamientos se van con la CASCADE", async () => {
    await syncPlantsBatch(db, [
      buildEntry({
        tratamientos: [buildTratamiento({ id: "t1", plantId: "p1" })],
      }),
    ]);

    await syncPlantsBatch(db, [buildEntry({ isActive: false })]);

    expect(await getAllPlants(db)).toHaveLength(0);
    expect(await db.getAllAsync("SELECT * FROM tratamientos")).toHaveLength(0);
  });

  it("conserva la plantación desactivada que tiene trabajo local sin sincronizar", async () => {
    await syncPlantsBatch(db, [
      buildEntry({
        plant: buildRecord({ id: "p1", syncStatus: SyncStatus.pending }),
      }),
    ]);

    await syncPlantsBatch(db, [
      buildEntry({
        plant: buildRecord({ id: "p1", syncStatus: SyncStatus.pending }),
        isActive: false,
      }),
    ]);

    expect(await getAllPlants(db)).toHaveLength(1);
  });
});

describe("getAllPlants", () => {
  it("ordena los tratamientos por temporada descendente y luego por nombre", async () => {
    const db = createInMemoryDb();
    await runMigrations(db);

    await syncPlantsBatch(db, [
      buildEntry({
        tratamientos: [
          buildTratamiento({
            id: "a",
            plantId: "p1",
            name: "Zeta",
            temporada: 2025,
          }),
          buildTratamiento({
            id: "b",
            plantId: "p1",
            name: "Beta",
            temporada: 2026,
          }),
          buildTratamiento({
            id: "c",
            plantId: "p1",
            name: "Alfa",
            temporada: 2026,
          }),
        ],
      }),
    ]);

    const [plant] = await getAllPlants(db);
    expect(plant.tratamientos.map((t) => t.name)).toEqual([
      "Alfa",
      "Beta",
      "Zeta",
    ]);
  });
});
