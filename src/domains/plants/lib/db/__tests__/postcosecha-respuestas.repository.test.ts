import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import type { PlantRecord } from "../../../types";
import { deletePlant, upsertPlant } from "../plants.repository";
import {
  getPostcosechaFotos,
  insertPostcosechaFoto,
} from "../postcosecha-fotos.repository";
import {
  deletePostcosechaRespuestas,
  getPostcosechaProgress,
  getPostcosechaRespuestas,
  savePostcosechaRespuesta,
} from "../postcosecha-respuestas.repository";
import { postcosechaKey } from "../../postcosecha-progress";
import { buildFrutaDefaults } from "../../postcosecha-fruta";
import { createComentarios } from "../../comentarios";

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

/** Lo que el repositorio no devuelve pero sí escribe: los dos derivados. */
const derivados = (db: SQLiteDatabase, evalId = "15caja", seccion = "fruta") =>
  db.getFirstAsync<{ hasError: number; progress: number }>(
    `SELECT hasError, progress FROM postcosecha_respuestas
      WHERE plantId = ? AND evalId = ? AND seccion = ?`,
    ["p1", evalId, seccion],
  );

describe("postcosecha-respuestas.repository", () => {
  let db: SQLiteDatabase;

  const guardarFruta = (
    fruta: Partial<ReturnType<typeof buildFrutaDefaults>> = {},
    evalId = "15caja",
    plantId = "p1",
  ) =>
    savePostcosechaRespuesta(db, {
      plantId,
      evalId,
      seccion: "fruta",
      payload: { ...buildFrutaDefaults(), ...fruta },
      updatedAtLocal: "2026-09-29T10:00:00.000Z",
    });

  beforeEach(async () => {
    db = createInMemoryDb();
    await runMigrations(db);
    await upsertPlant(db, buildRecord({ id: "p1" }));
    await upsertPlant(db, buildRecord({ id: "p2" }));
  });

  it("guarda una sección y la devuelve", async () => {
    await guardarFruta({ acidez: "medium" });

    expect(await getPostcosechaRespuestas(db, "p1", "15caja")).toEqual([
      expect.objectContaining({
        plantId: "p1",
        evalId: "15caja",
        seccion: "fruta",
        payload: expect.objectContaining({ acidez: "medium" }),
        syncStatus: "pending",
        syncedAt: null,
      }),
    ]);
  });

  it("guardar dos veces actualiza la fila, no la duplica", async () => {
    await guardarFruta({ acidez: "low" });
    await guardarFruta({ acidez: "high" });

    const filas = await getPostcosechaRespuestas(db, "p1", "15caja");

    expect(filas).toHaveLength(1);
    expect(filas[0].payload).toMatchObject({ acidez: "high" });
  });

  /**
   * Las cuatro evaluaciones de una plantación comparten tabla, así que sin el
   * `evalId` en el `WHERE` lo de los 15 días saldría en los 30.
   */
  it("no mezcla las cuatro evaluaciones de una misma plantación", async () => {
    await guardarFruta({ acidez: "low" }, "15caja");
    await guardarFruta({ acidez: "high" }, "30plastico");

    expect(
      (await getPostcosechaRespuestas(db, "p1", "15caja"))[0].payload,
    ).toMatchObject({ acidez: "low" });
    expect(
      (await getPostcosechaRespuestas(db, "p1", "30plastico"))[0].payload,
    ).toMatchObject({ acidez: "high" });
  });

  it("no mezcla plantaciones distintas", async () => {
    await guardarFruta({ acidez: "low" }, "15caja", "p1");
    await guardarFruta({ acidez: "high" }, "15caja", "p2");

    expect(
      (await getPostcosechaRespuestas(db, "p2", "15caja"))[0].payload,
    ).toMatchObject({ acidez: "high" });
  });

  it("borrar la plantación se lleva lo capturado en post-cosecha", async () => {
    await guardarFruta();
    await deletePlant(db, "p1");

    expect(await getPostcosechaRespuestas(db, "p1", "15caja")).toEqual([]);
  });

  describe("los derivados los calcula el propio guardado", () => {
    /**
     * Lo que hace segura una columna derivada: no hay forma de escribir una fila
     * cuyo `hasError` no corresponda con su payload, porque quien llama no puede
     * ponerlo.
     */
    it("marca la evaluación anterior al empaque", async () => {
      await guardarFruta({
        fecha_empaque: "2026-09-29",
        fecha_evaluacion: "2026-09-28",
      });

      expect(await derivados(db)).toMatchObject({ hasError: 1 });
    });

    // La otra mitad, y la que de verdad importa: una marca que se pone pero no
    // se quita deja la fila mintiendo para siempre.
    it("se corrige sola al volver a guardar con la fecha buena", async () => {
      await guardarFruta({
        fecha_empaque: "2026-09-29",
        fecha_evaluacion: "2026-09-28",
      });
      await guardarFruta({
        fecha_empaque: "2026-09-29",
        fecha_evaluacion: "2026-10-14",
      });

      expect(await derivados(db)).toMatchObject({ hasError: 0 });
    });

    // 1 de 11 → 9 %, y no el peso que esa sección tiene dentro de la
    // evaluación: la columna guarda su propio relleno y quien la lee aplica el
    // peso. Una sección en blanco guarda 0.
    it("escribe el relleno de la sección, no su peso en la evaluación", async () => {
      await guardarFruta({ acidez: "medium" });
      expect(await derivados(db)).toMatchObject({ progress: 9 });

      await guardarFruta();
      expect(await derivados(db)).toMatchObject({ progress: 0 });
    });

    it("las notas no reparten avance", async () => {
      await savePostcosechaRespuesta(db, {
        plantId: "p1",
        evalId: "15caja",
        seccion: "comentarios",
        payload: { ...createComentarios(), positivos: "Buena uniformidad." },
        updatedAtLocal: "2026-09-29T10:00:00.000Z",
      });

      expect(await derivados(db, "15caja", "comentarios")).toMatchObject({
        progress: 0,
      });
    });
  });

  describe("el avance que lee el listado", () => {
    const foto = (evalId: string, clientId: string, plantId = "p1") =>
      insertPostcosechaFoto(db, {
        clientId,
        plantId,
        evalId,
        categoria: "racimos",
        fileName: `${clientId}.jpg`,
        capturedAt: "2026-09-29T10:00:00.000Z",
      });

    it("lo que nadie tocó no sale en el mapa", async () => {
      expect(await getPostcosechaProgress(db)).toEqual(new Map());
    });

    it("cuenta la fruta capturada", async () => {
      await guardarFruta({ acidez: "medium" });

      expect(
        (await getPostcosechaProgress(db)).get(postcosechaKey("p1", "15caja")),
      ).toBeCloseTo(1 / 12);
    });

    /**
     * La trampa que ya está anotada en `getTratamientoProgress`: una evaluación
     * con fotografía y sin nada contestado **no tiene fila**, así que recorrer
     * solo las filas del SELECT la dejaría en cero.
     */
    it("conoce a la evaluación que solo tiene fotografía", async () => {
      await foto("30caja", "f1");

      expect(
        (await getPostcosechaProgress(db)).get(postcosechaKey("p1", "30caja")),
      ).toBeCloseTo(1 / 12);
    });

    it("no suma las cuatro evaluaciones entre ellas", async () => {
      await guardarFruta({ acidez: "medium" }, "15caja");
      await foto("15caja", "f1");
      await foto("30plastico", "f2");

      const avance = await getPostcosechaProgress(db);

      expect(avance.get(postcosechaKey("p1", "15caja"))).toBeCloseTo(2 / 12);
      expect(avance.get(postcosechaKey("p1", "30plastico"))).toBeCloseTo(
        1 / 12,
      );
    });

    it("no mezcla plantaciones", async () => {
      await foto("15caja", "f1", "p1");
      await foto("15caja", "f2", "p2");

      const avance = await getPostcosechaProgress(db);

      expect(avance.get(postcosechaKey("p1", "15caja"))).toBeCloseTo(1 / 12);
      expect(avance.get(postcosechaKey("p2", "15caja"))).toBeCloseTo(1 / 12);
    });
  });

  describe("limpiar", () => {
    it("borra la evaluación abierta y deja intactas sus hermanas", async () => {
      await guardarFruta({ acidez: "low" }, "15caja");
      await guardarFruta({ acidez: "high" }, "30caja");

      await deletePostcosechaRespuestas(db, "p1", "15caja");

      expect(await getPostcosechaRespuestas(db, "p1", "15caja")).toEqual([]);
      expect(await getPostcosechaRespuestas(db, "p1", "30caja")).toHaveLength(
        1,
      );
    });

    /**
     * Las fotografías cuelgan de otra tabla y tienen archivos en disco detrás,
     * así que este borrado no las alcanza. Quien limpia las borra aparte — y
     * este test es lo que impide que alguien dé por hecho lo contrario.
     */
    it("no se lleva las fotografías", async () => {
      await guardarFruta();
      await insertPostcosechaFoto(db, {
        clientId: "f1",
        plantId: "p1",
        evalId: "15caja",
        categoria: "racimos",
        fileName: "f1.jpg",
        capturedAt: "2026-09-29T10:00:00.000Z",
      });

      await deletePostcosechaRespuestas(db, "p1", "15caja");

      expect(await getPostcosechaFotos(db, "p1", "15caja")).toHaveLength(1);
    });
  });
});
