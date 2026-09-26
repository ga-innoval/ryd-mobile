import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import { buildTratamiento } from "@/test-utils/factories/tratamiento.factory";
import type { PlantRecord } from "../../../types";
import { deletePlant, upsertPlant } from "../plants.repository";
import {
  deleteTratamiento,
  upsertTratamiento,
} from "../tratamientos.repository";
import {
  deleteFotos,
  getAllFotoFileNames,
  getFotoCategoriaCounts,
  getFotoFileNames,
  getFotosByTratamiento,
  insertFoto,
} from "../respuesta-fotos.repository";

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

describe("respuesta-fotos.repository", () => {
  let db: SQLiteDatabase;

  const foto = (
    clientId: string,
    categoria: string,
    capturedAt = "2026-09-25T10:00:00.000Z",
    tratamientoId = "t1",
  ) =>
    insertFoto(db, {
      clientId,
      tratamientoId,
      categoria,
      fileName: `${clientId}.jpg`,
      capturedAt,
    });

  beforeEach(async () => {
    db = createInMemoryDb();
    await runMigrations(db);
    await upsertPlant(db, buildRecord({ id: "p1" }));
    await upsertTratamiento(db, buildTratamiento({ id: "t1", plantId: "p1" }));
    await upsertTratamiento(db, buildTratamiento({ id: "t2", plantId: "p1" }));
  });

  it("guarda la ficha de una fotografía", async () => {
    await foto("f1", "racimo");

    expect(await getFotosByTratamiento(db, "t1")).toEqual([
      expect.objectContaining({
        clientId: "f1",
        categoria: "racimo",
        fileName: "f1.jpg",
        syncedAt: null,
      }),
    ]);
  });

  it("las devuelve en el orden en que se capturaron", async () => {
    await foto("f2", "racimo", "2026-09-25T11:00:00.000Z");
    await foto("f1", "racimo", "2026-09-25T10:00:00.000Z");

    const orden = (await getFotosByTratamiento(db, "t1")).map(
      (f) => f.clientId,
    );

    expect(orden).toEqual(["f1", "f2"]);
  });

  // Elegir varias de la galería inserta N filas en el mismo milisegundo; sin
  // desempate, cuál es «la última» sería arbitrario dentro del lote.
  it("desempata el lote por orden de inserción", async () => {
    const misma = "2026-09-25T10:00:00.000Z";
    await foto("f1", "racimo", misma);
    await foto("f2", "racimo", misma);
    await foto("f3", "racimo", misma);

    const orden = (await getFotosByTratamiento(db, "t1")).map(
      (f) => f.clientId,
    );

    expect(orden).toEqual(["f1", "f2", "f3"]);
  });

  it("no mezcla las de dos tratamientos", async () => {
    await foto("f1", "racimo");
    await foto("f2", "racimo", "2026-09-25T10:00:00.000Z", "t2");

    expect(await getFotosByTratamiento(db, "t1")).toHaveLength(1);
  });

  it("no duplica al reinsertar el mismo id", async () => {
    await foto("f1", "racimo");
    await foto("f1", "racimo");

    expect(await getFotosByTratamiento(db, "t1")).toHaveLength(1);
  });

  describe("borrado", () => {
    it("borra en lote y devuelve antes sus nombres de archivo", async () => {
      await foto("f1", "racimo");
      await foto("f2", "corte-vertical");
      await foto("f3", "corte-horizontal");

      // El orden importa: después del DELETE ya no hay de dónde sacarlos.
      const nombres = await getFotoFileNames(db, ["f1", "f3"]);
      await deleteFotos(db, ["f1", "f3"]);

      expect(nombres.sort()).toEqual(["f1.jpg", "f3.jpg"]);
      expect(
        (await getFotosByTratamiento(db, "t1")).map((f) => f.clientId),
      ).toEqual(["f2"]);
    });

    it("borrar un id que no existe no hace nada", async () => {
      await foto("f1", "racimo");

      await deleteFotos(db, ["fantasma"]);

      expect(await getFotosByTratamiento(db, "t1")).toHaveLength(1);
    });

    it("borrar el tratamiento se lleva sus fotografías", async () => {
      await foto("f1", "racimo");
      expect(await getFotosByTratamiento(db, "t1")).toHaveLength(1);

      await deleteTratamiento(db, "t1");

      expect(await getFotosByTratamiento(db, "t1")).toHaveLength(0);
    });

    // La CASCADE encadena: plantación → tratamientos → fotografías.
    it("borrar la plantación se lleva las de todos sus tratamientos", async () => {
      await foto("f1", "racimo");
      await foto("f2", "racimo", "2026-09-25T10:00:00.000Z", "t2");

      await deletePlant(db, "p1");

      expect(await getAllFotoFileNames(db)).toEqual(new Set());
    });
  });

  describe("getFotoCategoriaCounts", () => {
    it("cuenta tomas distintas, no fotografías", async () => {
      await foto("f1", "racimo");
      await foto("f2", "racimo");
      await foto("f3", "corte-vertical");

      expect(await getFotoCategoriaCounts(db)).toEqual(new Map([["t1", 2]]));
    });

    it("no cuenta una categoría que ya no está en el catálogo", async () => {
      await foto("f1", "racimo");
      await foto("f2", "categoria-retirada");

      expect(await getFotoCategoriaCounts(db)).toEqual(new Map([["t1", 1]]));
    });

    it("separa por tratamiento", async () => {
      await foto("f1", "racimo");
      await foto("f2", "racimo", "2026-09-25T10:00:00.000Z", "t2");

      expect(await getFotoCategoriaCounts(db)).toEqual(
        new Map([
          ["t1", 1],
          ["t2", 1],
        ]),
      );
    });
  });
});
