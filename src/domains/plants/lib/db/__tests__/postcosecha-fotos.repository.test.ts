import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import { buildTratamiento } from "@/test-utils/factories/tratamiento.factory";
import type { PlantRecord } from "../../../types";
import { deletePlant, upsertPlant } from "../plants.repository";
import { upsertTratamiento } from "../tratamientos.repository";
import { insertFoto, getAllFotoFileNames } from "../respuesta-fotos.repository";
import {
  deletePostcosechaFotos,
  getAllPostcosechaFotoFileNames,
  getPostcosechaFotoFileNames,
  getPostcosechaFotos,
  insertPostcosechaFoto,
} from "../postcosecha-fotos.repository";

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

describe("postcosecha-fotos.repository", () => {
  let db: SQLiteDatabase;

  const foto = (
    clientId: string,
    evalId = "15caja",
    capturedAt = "2026-09-29T10:00:00.000Z",
    plantId = "p1",
  ) =>
    insertPostcosechaFoto(db, {
      clientId,
      plantId,
      evalId,
      categoria: "racimos",
      fileName: `${clientId}.jpg`,
      capturedAt,
    });

  beforeEach(async () => {
    db = createInMemoryDb();
    await runMigrations(db);
    await upsertPlant(db, buildRecord({ id: "p1" }));
    await upsertPlant(db, buildRecord({ id: "p2" }));
  });

  it("guarda la ficha de una fotografía", async () => {
    await foto("f1");

    expect(await getPostcosechaFotos(db, "p1", "15caja")).toEqual([
      expect.objectContaining({
        clientId: "f1",
        evalId: "15caja",
        categoria: "racimos",
        fileName: "f1.jpg",
        syncedAt: null,
      }),
    ]);
  });

  // Elegir varias de la galería inserta N filas en el mismo milisegundo; sin
  // desempate, cuál es «la última» sería arbitrario dentro del lote.
  it("desempata el lote por orden de inserción", async () => {
    const misma = "2026-09-29T10:00:00.000Z";
    await foto("f1", "15caja", misma);
    await foto("f2", "15caja", misma);
    await foto("f3", "15caja", misma);

    const orden = (await getPostcosechaFotos(db, "p1", "15caja")).map(
      (f) => f.clientId,
    );

    expect(orden).toEqual(["f1", "f2", "f3"]);
  });

  /** Las cuatro evaluaciones son de la misma plantación, así que separarlas es
   *  cosa del `evalId` y no de la FK. */
  it("no mezcla dos evaluaciones de la misma plantación", async () => {
    await foto("f1", "15caja");
    await foto("f2", "30plastico");

    expect(await getPostcosechaFotos(db, "p1", "15caja")).toHaveLength(1);
    expect(await getPostcosechaFotos(db, "p1", "30plastico")).toHaveLength(1);
  });

  it("no mezcla dos plantaciones", async () => {
    await foto("f1", "15caja");
    await foto("f2", "15caja", "2026-09-29T10:00:00.000Z", "p2");

    expect(await getPostcosechaFotos(db, "p1", "15caja")).toHaveLength(1);
  });

  it("no duplica al reinsertar el mismo id", async () => {
    await foto("f1");
    await foto("f1");

    expect(await getPostcosechaFotos(db, "p1", "15caja")).toHaveLength(1);
  });

  it("borra en lote y devuelve antes sus nombres de archivo", async () => {
    await foto("f1");
    await foto("f2");
    await foto("f3");

    // El orden importa: después del DELETE ya no hay de dónde sacarlos.
    const nombres = await getPostcosechaFotoFileNames(db, ["f1", "f3"]);
    await deletePostcosechaFotos(db, ["f1", "f3"]);

    expect(nombres.sort()).toEqual(["f1.jpg", "f3.jpg"]);
    expect(
      (await getPostcosechaFotos(db, "p1", "15caja")).map((f) => f.clientId),
    ).toEqual(["f2"]);
  });

  it("borrar la plantación se lleva sus fotografías de post-cosecha", async () => {
    await foto("f1", "15caja");
    await foto("f2", "30caja");

    await deletePlant(db, "p1");

    expect(await getAllPostcosechaFotoFileNames(db)).toEqual(new Set());
  });

  /**
   * Lo que sostiene la barrida de huérfanos.
   *
   * Las dos tablas comparten carpeta en disco, así que `sweepOrphanPhotos` une
   * los dos juegos de nombres. Si alguien lo dejara mirando solo una, **todas
   * las fotos de la otra pasarían a ser huérfanas** y la siguiente descarga las
   * borraría del disco sin avisar. Aquí se fija que cada tabla solo conoce lo
   * suyo, que es la razón de que haya que unirlas.
   */
  it("cada tabla solo conoce sus propios archivos", async () => {
    await upsertTratamiento(db, buildTratamiento({ id: "t1", plantId: "p1" }));
    await insertFoto(db, {
      clientId: "tratamiento-1",
      tratamientoId: "t1",
      categoria: "racimo",
      fileName: "tratamiento-1.jpg",
      capturedAt: "2026-09-29T10:00:00.000Z",
    });
    await foto("postcosecha-1");

    expect(await getAllFotoFileNames(db)).toEqual(
      new Set(["tratamiento-1.jpg"]),
    );
    expect(await getAllPostcosechaFotoFileNames(db)).toEqual(
      new Set(["postcosecha-1.jpg"]),
    );
  });
});
