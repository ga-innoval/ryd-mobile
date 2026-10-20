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
import { markRespuestaSynced, saveRespuesta } from "../respuestas.repository";
import { createComentarios } from "../../comentarios";

/** Deja capturada —y sin mandar— una sección de ese tratamiento. */
const capturarSinMandar = (db: SQLiteDatabase, tratamientoId: string) =>
  saveRespuesta(db, {
    tratamientoId,
    seccion: "comentarios",
    payload: { ...createComentarios(), positivos: "trabajo de campo" },
    updatedAtLocal: "2026-01-01T10:00:00.000Z",
  });

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

const buildEntry = (
  overrides: Partial<PlantSyncEntry> = {},
): PlantSyncEntry => {
  const plant =
    overrides.plant ?? buildRecord({ id: "p1", syncStatus: SyncStatus.synced });

  return {
    plant,
    tratamientos: [
      buildTratamiento({ id: `t-${plant.id}`, plantId: plant.id }),
    ],
    isActive: true,
    ...overrides,
  };
};

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

  // El guard de verdad: antes miraba `syncStatus` de la propia plantación, que
  // el mapper del pull escribe siempre como `synced`, así que nunca impedía
  // nada. Ahora mira si quedó captura sin mandar — que es lo que la CASCADE
  // destruiría y no se puede repetir.
  it("conserva la plantación desactivada que tiene trabajo local sin sincronizar", async () => {
    await syncPlantsBatch(db, [buildEntry()]);
    await capturarSinMandar(db, "t-p1");

    await syncPlantsBatch(db, [buildEntry({ isActive: false })]);

    expect(await getAllPlants(db)).toHaveLength(1);
  });

  it("y la borra en cuanto esa captura llegó al servidor", async () => {
    await syncPlantsBatch(db, [buildEntry()]);
    await capturarSinMandar(db, "t-p1");
    await markRespuestaSynced(
      db,
      {
        tratamientoId: "t-p1",
        seccion: "comentarios",
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      },
      "2026-01-01T10:00:01.000Z",
    );

    await syncPlantsBatch(db, [buildEntry({ isActive: false })]);

    expect(await getAllPlants(db)).toHaveLength(0);
  });
});

describe("syncPlantsBatch: solo plantaciones con tratamientos", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = createInMemoryDb();
    await runMigrations(db);
  });

  it("no guarda una plantación sin tratamientos", async () => {
    await syncPlantsBatch(db, [buildEntry({ tratamientos: [] })]);

    expect(await getAllPlants(db)).toHaveLength(0);
  });

  it("no guarda una plantación cuyos tratamientos están todos de baja", async () => {
    // Distingue `some(isActive)` de `length`: hay filas, pero ninguna usable.
    await syncPlantsBatch(db, [
      buildEntry({
        tratamientos: [
          buildTratamiento({ id: "t1", plantId: "p1", isActive: false }),
          buildTratamiento({ id: "t2", plantId: "p1", isActive: false }),
        ],
      }),
    ]);

    expect(await getAllPlants(db)).toHaveLength(0);
  });

  it("borra la que se queda sin tratamientos activos, con su CASCADE", async () => {
    await syncPlantsBatch(db, [buildEntry()]);
    expect(await getAllPlants(db)).toHaveLength(1);

    await syncPlantsBatch(db, [
      buildEntry({
        tratamientos: [
          buildTratamiento({ id: "t-p1", plantId: "p1", isActive: false }),
        ],
      }),
    ]);

    expect(await getAllPlants(db)).toHaveLength(0);
    expect(await db.getAllAsync("SELECT * FROM tratamientos")).toHaveLength(0);
  });

  // Aquí **no había guard ninguno**, y es el camino que de verdad se recorre:
  // dar de baja un tratamiento es mucho más rutinario que dar de baja una
  // plantación entera, y la CASCADE se lleva sus respuestas y sus fotografías.
  it("conserva el tratamiento dado de baja que tiene captura sin mandar", async () => {
    await syncPlantsBatch(db, [
      {
        plant: buildRecord({ id: "p1" }),
        tratamientos: [
          buildTratamiento({ id: "t1", plantId: "p1" }),
          buildTratamiento({ id: "t2", plantId: "p1" }),
        ],
        isActive: true,
      },
    ]);
    await capturarSinMandar(db, "t2");

    await syncPlantsBatch(db, [
      {
        plant: buildRecord({ id: "p1" }),
        tratamientos: [
          buildTratamiento({ id: "t1", plantId: "p1" }),
          buildTratamiento({ id: "t2", plantId: "p1", isActive: false }),
        ],
        isActive: true,
      },
    ]);

    expect((await tratamientosOf(db, "p1")).map((t) => t.id)).toContain("t2");
  });

  it("conserva el tratamiento borrado en remoto que tiene captura sin mandar", async () => {
    await syncPlantsBatch(db, [
      {
        plant: buildRecord({ id: "p1" }),
        tratamientos: [
          buildTratamiento({ id: "t1", plantId: "p1" }),
          buildTratamiento({ id: "t2", plantId: "p1" }),
        ],
        isActive: true,
      },
    ]);
    await capturarSinMandar(db, "t2");

    // Llega como ausencia: la fila ya no existe en el servidor.
    await syncPlantsBatch(db, [
      {
        plant: buildRecord({ id: "p1" }),
        tratamientos: [buildTratamiento({ id: "t1", plantId: "p1" })],
        isActive: true,
      },
    ]);

    expect((await tratamientosOf(db, "p1")).map((t) => t.id)).toContain("t2");
  });

  it("poda el tratamiento borrado físicamente, que llega como ausencia", async () => {
    // Un borrado físico en el admin no manda lápida: la fila ya no existe,
    // así que simplemente no viene en el array.
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
        tratamientos: [buildTratamiento({ id: "t1", plantId: "p1" })],
      }),
    ]);

    expect((await tratamientosOf(db, "p1")).map((t) => t.id)).toEqual(["t1"]);
  });

  it("la poda por ausencia no toca los de otra plantación", async () => {
    // El `WHERE plantId = ?` es lo que evita que un NOT IN global borre los
    // tratamientos de las plantaciones que no vinieron en este pull.
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
        tratamientos: [buildTratamiento({ id: "t1", plantId: "p1" })],
      }),
    ]);

    expect((await tratamientosOf(db, "p1")).map((t) => t.id)).toEqual(["t1"]);
    expect((await tratamientosOf(db, "p2")).map((t) => t.id)).toEqual(["t3"]);
  });

  it("cuenta solo las que almacenó, no las recibidas", async () => {
    const stored = await syncPlantsBatch(db, [
      buildEntry(),
      buildEntry({
        plant: buildRecord({ id: "p2", syncStatus: SyncStatus.synced }),
        tratamientos: [],
      }),
      buildEntry({
        plant: buildRecord({ id: "p3", syncStatus: SyncStatus.synced }),
      }),
    ]);

    expect(stored).toBe(2);
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

describe("getAllPlants filtrando por campos del usuario", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = createInMemoryDb();
    await runMigrations(db);
    await syncPlantsBatch(db, [
      buildEntry({ plant: buildRecord({ id: "a", campoId: 1 }) }),
      buildEntry({ plant: buildRecord({ id: "b", campoId: 2 }) }),
      buildEntry({ plant: buildRecord({ id: "c", campoId: 99 }) }),
    ]);
  });

  it("solo devuelve las de sus campos", async () => {
    const plants = await getAllPlants(db, [1, 99]);

    expect(plants.map((p) => p.id).sort()).toEqual(["a", "c"]);
  });

  it("con varios campos permitidos junta los de todos", async () => {
    expect((await getAllPlants(db, [1, 2, 99])).length).toBe(3);
  });

  it("sin campos no ve nada, y las de otro campo se esconden sin borrarse", async () => {
    expect(await getAllPlants(db, [])).toEqual([]);
    expect((await getAllPlants(db, [2])).map((p) => p.id)).toEqual(["b"]);
    // Siguen en la base: volver a darle el campo las recupera.
    expect((await getAllPlants(db)).length).toBe(3);
  });
});
