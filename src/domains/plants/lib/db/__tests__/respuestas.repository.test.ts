import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import { buildTratamiento } from "@/test-utils/factories/tratamiento.factory";
import { SyncStatus, type PlantRecord } from "../../../types";
import { createBrixCorte } from "../../brix";
import { createComentarios } from "../../comentarios";
import { createCribaCalibres } from "../../criba";
import { upsertPlant } from "../plants.repository";
import {
  deleteTratamiento,
  upsertTratamiento,
} from "../tratamientos.repository";
import { insertFoto } from "../respuesta-fotos.repository";
import {
  getPendingRespuestas,
  getRespuestasByTratamiento,
  getTratamientoIdsWithErrors,
  getTratamientoProgress,
  markRespuestaSynced,
  saveRespuesta,
} from "../respuestas.repository";
import { buildEvaluationDefaults } from "../../evaluation-schema";

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

const comentarios = {
  ...createComentarios(),
  positivos: "Buena uniformidad de color.",
};

describe("respuestas.repository", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = createInMemoryDb();
    await runMigrations(db);
    await upsertPlant(db, buildRecord({ id: "p1" }));
    await upsertTratamiento(db, buildTratamiento({ id: "t1", plantId: "p1" }));
    await upsertTratamiento(db, buildTratamiento({ id: "t2", plantId: "p1" }));
  });

  it("devuelve la sección tal como se capturó", async () => {
    await saveRespuesta(db, {
      tratamientoId: "t1",
      seccion: "comentarios",
      payload: comentarios,
      updatedAtLocal: "2026-09-24T14:00:00.000Z",
    });

    const [saved] = await getRespuestasByTratamiento(db, "t1");

    expect(saved).toMatchObject({
      tratamientoId: "t1",
      seccion: "comentarios",
      payload: comentarios,
      syncStatus: SyncStatus.pending,
      syncedAt: null,
    });
  });

  it("no crea fila para una sección que nadie tocó", async () => {
    await saveRespuesta(db, {
      tratamientoId: "t1",
      seccion: "comentarios",
      payload: comentarios,
      updatedAtLocal: "2026-09-24T14:00:00.000Z",
    });

    const saved = await getRespuestasByTratamiento(db, "t1");

    // Una sola sección capturada, no seis con las otras cinco vacías: sin fila
    // y fila vacía tienen que seguir siendo distinguibles.
    expect(saved).toHaveLength(1);
  });

  it("guardar dos veces la misma sección la actualiza, no la duplica", async () => {
    const guardar = (positivos: string, updatedAtLocal: string) =>
      saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: { ...comentarios, positivos },
        updatedAtLocal,
      });

    await guardar("Primera nota", "2026-09-24T14:00:00.000Z");
    await guardar("Nota corregida", "2026-09-24T15:00:00.000Z");

    const saved = await getRespuestasByTratamiento(db, "t1");

    expect(saved).toHaveLength(1);
    expect(saved[0].payload).toMatchObject({ positivos: "Nota corregida" });
  });

  it("guardar una sección no toca las demás", async () => {
    await saveRespuesta(db, {
      tratamientoId: "t1",
      seccion: "brix",
      payload: { cortes: [createBrixCorte()] },
      updatedAtLocal: "2026-09-24T14:00:00.000Z",
    });
    await saveRespuesta(db, {
      tratamientoId: "t1",
      seccion: "criba",
      payload: { calibres: createCribaCalibres() },
      updatedAtLocal: "2026-09-24T14:30:00.000Z",
    });

    const secciones = (await getRespuestasByTratamiento(db, "t1")).map(
      (respuesta) => respuesta.seccion,
    );

    expect(secciones).toEqual(expect.arrayContaining(["brix", "criba"]));
    expect(secciones).toHaveLength(2);
  });

  it("no mezcla las respuestas de dos tratamientos", async () => {
    await saveRespuesta(db, {
      tratamientoId: "t1",
      seccion: "comentarios",
      payload: comentarios,
      updatedAtLocal: "2026-09-24T14:00:00.000Z",
    });
    await saveRespuesta(db, {
      tratamientoId: "t2",
      seccion: "comentarios",
      payload: createComentarios(),
      updatedAtLocal: "2026-09-24T14:00:00.000Z",
    });

    const saved = await getRespuestasByTratamiento(db, "t1");

    expect(saved).toHaveLength(1);
    expect(saved[0].payload).toMatchObject({
      positivos: "Buena uniformidad de color.",
    });
  });

  describe("cola del push", () => {
    beforeEach(async () => {
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "criba",
        payload: { calibres: createCribaCalibres() },
        updatedAtLocal: "2026-09-24T15:00:00.000Z",
      });
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: comentarios,
        updatedAtLocal: "2026-09-24T14:00:00.000Z",
      });
    });

    it("trae lo pendiente de lo más viejo a lo más nuevo", async () => {
      const pending = await getPendingRespuestas(db);

      // Lo que más tiempo lleva esperando sale primero, aunque se haya guardado
      // después: es lo que más arriesga perderse.
      expect(pending.map((respuesta) => respuesta.seccion)).toEqual([
        "comentarios",
        "criba",
      ]);
    });

    it("marcar sincronizada saca la sección de la cola", async () => {
      await markRespuestaSynced(
        db,
        {
          tratamientoId: "t1",
          seccion: "criba",
          updatedAtLocal: "2026-09-24T15:00:00.000Z",
        },
        "2026-09-24T18:00:00.000Z",
      );

      const pending = await getPendingRespuestas(db);
      const criba = (await getRespuestasByTratamiento(db, "t1")).find(
        (respuesta) => respuesta.seccion === "criba",
      );

      expect(pending.map((respuesta) => respuesta.seccion)).toEqual([
        "comentarios",
      ]);
      expect(criba).toMatchObject({
        syncStatus: SyncStatus.synced,
        syncedAt: "2026-09-24T18:00:00.000Z",
      });
    });

    it("editar una sección ya sincronizada la devuelve a la cola", async () => {
      await markRespuestaSynced(
        db,
        {
          tratamientoId: "t1",
          seccion: "criba",
          updatedAtLocal: "2026-09-24T15:00:00.000Z",
        },
        "2026-09-24T18:00:00.000Z",
      );

      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "criba",
        payload: { calibres: createCribaCalibres() },
        updatedAtLocal: "2026-09-24T19:00:00.000Z",
      });

      const criba = (await getPendingRespuestas(db)).find(
        (respuesta) => respuesta.seccion === "criba",
      );

      // Y sin `syncedAt`: lo que el servidor tiene ya no es lo que hay aquí.
      expect(criba).toMatchObject({ syncedAt: null });
    });

    it("no marca sincronizada una sección que cambió mientras viajaba", async () => {
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "criba",
        payload: { calibres: createCribaCalibres() },
        updatedAtLocal: "2026-09-24T16:00:00.000Z",
      });

      // Llega la confirmación del envío anterior, el de las 15:00.
      await markRespuestaSynced(
        db,
        {
          tratamientoId: "t1",
          seccion: "criba",
          updatedAtLocal: "2026-09-24T15:00:00.000Z",
        },
        "2026-09-24T18:00:00.000Z",
      );

      const pending = await getPendingRespuestas(db);

      // La edición de las 16:00 no salió nunca de la tablet: sigue pendiente.
      expect(pending.map((respuesta) => respuesta.seccion)).toContain("criba");
    });
  });

  it("borrar el tratamiento se lleva sus respuestas", async () => {
    await saveRespuesta(db, {
      tratamientoId: "t1",
      seccion: "comentarios",
      payload: comentarios,
      updatedAtLocal: "2026-09-24T14:00:00.000Z",
    });

    // Que había algo que borrar: sin esto, el test pasaría igual si el guardado
    // no hubiera escrito nunca.
    expect(await getRespuestasByTratamiento(db, "t1")).toHaveLength(1);

    await deleteTratamiento(db, "t1");

    expect(await getRespuestasByTratamiento(db, "t1")).toHaveLength(0);
  });

  // La marca `hasError` es un dato derivado del payload, así que lo que hay que
  // sostener es que no puede quedarse desfasada: la pone el propio guardado.
  describe("hasError", () => {
    const rendimientoCon = (kilogramos: string, racimos: string) => {
      const { rendimiento } = buildEvaluationDefaults();
      rendimiento.cortes[0] = { fecha: "2026-09-25", kilogramos, racimos };
      return rendimiento;
    };

    const guardar = (tratamientoId: string, racimos: string) =>
      saveRespuesta(db, {
        tratamientoId,
        seccion: "rendimiento",
        payload: rendimientoCon("120.5", racimos),
        updatedAtLocal: "2026-09-25T10:00:00.000Z",
      });

    it("marca el tratamiento cuya captura no puede ser cierta", async () => {
      await guardar("t1", "0");

      expect(await getTratamientoIdsWithErrors(db)).toEqual(new Set(["t1"]));
    });

    it("no marca la captura que cuadra", async () => {
      await guardar("t1", "240");

      expect(await getTratamientoIdsWithErrors(db)).toEqual(new Set());
    });

    // Lo que hace seguro guardar un derivado: corregir el dato lo desmarca sin
    // que nadie tenga que acordarse.
    it("se corrige sola al volver a guardar la sección", async () => {
      await guardar("t1", "0");
      await guardar("t1", "240");

      expect(await getTratamientoIdsWithErrors(db)).toEqual(new Set());
    });

    it("no mezcla los tratamientos", async () => {
      await guardar("t1", "0");
      await guardar("t2", "240");

      expect(await getTratamientoIdsWithErrors(db)).toEqual(new Set(["t1"]));
    });
  });

  /**
   * El avance del tratamiento sale de dos tablas: la suma de las secciones
   * capturadas y el sexto de fotografías, que vive en `respuesta_fotos`.
   */
  describe("getTratamientoProgress", () => {
    const seisSecciones = 6;

    it("no conoce al tratamiento sin nada capturado", async () => {
      expect(await getTratamientoProgress(db)).toEqual(new Map());
    });

    it("reparte un sexto por sección llena", async () => {
      const { criba } = buildEvaluationDefaults();
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "criba",
        payload: {
          calibres: criba.calibres.map(() => ({ total: "100", average: "5" })),
        },
        updatedAtLocal: "2026-09-25T10:00:00.000Z",
      });

      expect((await getTratamientoProgress(db)).get("t1")).toBeCloseTo(
        1 / seisSecciones,
      );
    });

    it("suma las fotografías como un sexto más", async () => {
      await insertFoto(db, {
        clientId: "f1",
        tratamientoId: "t1",
        categoria: "racimo",
        fileName: "f1.jpg",
        capturedAt: "2026-09-25T10:00:00.000Z",
      });

      // Una de las tres tomas: un tercio del sexto que reparten las fotos.
      expect((await getTratamientoProgress(db)).get("t1")).toBeCloseTo(
        1 / 3 / seisSecciones,
        2,
      );
    });

    // El caso que se rompe solo: sin fila en `respuestas`, el tratamiento no
    // aparece en el SUM y se quedaría fuera del mapa.
    it("conoce al tratamiento que solo tiene fotografías", async () => {
      await insertFoto(db, {
        clientId: "f1",
        tratamientoId: "t2",
        categoria: "racimo",
        fileName: "f1.jpg",
        capturedAt: "2026-09-25T10:00:00.000Z",
      });

      const progress = await getTratamientoProgress(db);

      expect(progress.has("t2")).toBe(true);
      expect(progress.get("t2")).toBeGreaterThan(0);
    });
  });
});
