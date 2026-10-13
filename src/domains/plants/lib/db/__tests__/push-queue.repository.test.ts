import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import { buildTratamiento } from "@/test-utils/factories/tratamiento.factory";
import { SyncStatus, type PlantRecord } from "../../../types";
import {
  deletePlant,
  hasUnsyncedWorkForPlant,
  upsertPlant,
} from "../plants.repository";
import { upsertTratamiento } from "../tratamientos.repository";
import {
  getPendingRespuestas,
  getTratamientoSyncState,
  hasUnsyncedWorkForTratamiento,
  markRespuestaRejected,
  markRespuestaSynced,
  saveRespuesta,
} from "../respuestas.repository";
import {
  getPendingPostcosechaRespuestas,
  markPostcosechaRespuestaSynced,
  savePostcosechaRespuesta,
} from "../postcosecha-respuestas.repository";
import {
  getPendingFotos,
  insertFoto,
  markFotoSynced,
} from "../respuesta-fotos.repository";
import {
  getPendingPostcosechaFotos,
  insertPostcosechaFoto,
  markPostcosechaFotoSynced,
} from "../postcosecha-fotos.repository";
import { createComentarios } from "../../comentarios";

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

const notas = (positivos: string) => ({
  ...createComentarios(),
  positivos,
});

describe("la cola del push", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = createInMemoryDb();
    await runMigrations(db);
    await upsertPlant(db, buildRecord({ id: "p1" }));
    await upsertPlant(db, buildRecord({ id: "p2", name: "Otra" }));
    await upsertTratamiento(db, buildTratamiento({ id: "t1", plantId: "p1" }));
    await upsertTratamiento(db, buildTratamiento({ id: "t2", plantId: "p2" }));
  });

  describe("respuestas de tratamiento", () => {
    it("el alcance filtra por tratamiento sin dejar de ordenar por antigüedad", async () => {
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: notas("de t1, vieja"),
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      });
      await saveRespuesta(db, {
        tratamientoId: "t2",
        seccion: "comentarios",
        payload: notas("de t2"),
        updatedAtLocal: "2026-01-01T09:00:00.000Z",
      });
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "exterior",
        payload: {},
        updatedAtLocal: "2026-01-01T11:00:00.000Z",
      });

      const todas = await getPendingRespuestas(db);
      expect(todas.map((r) => r.tratamientoId)).toEqual(["t2", "t1", "t1"]);

      const deT1 = await getPendingRespuestas(db, "t1");
      expect(deT1).toHaveLength(2);
      expect(deT1.map((r) => r.seccion)).toEqual(["comentarios", "exterior"]);
    });

    // Un rechazo por encuesta cerrada sale de la cola —reintentar no la abre—
    // pero no se puede decir que llegó: `syncedAt` se queda en `NULL`.
    it("una sección rechazada sale de la cola y vuelve al editarla", async () => {
      const key = {
        tratamientoId: "t1",
        seccion: "comentarios" as const,
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      };

      await saveRespuesta(db, { ...key, payload: notas("algo") });
      await markRespuestaRejected(db, key);

      expect(await getPendingRespuestas(db, "t1")).toHaveLength(0);

      const row = await db.getFirstAsync<{
        syncStatus: string;
        syncedAt: string | null;
      }>(
        "SELECT syncStatus, syncedAt FROM respuestas WHERE tratamientoId = ? AND seccion = ?",
        ["t1", "comentarios"],
      );
      expect(row).toEqual({
        syncStatus: SyncStatus.rejected_closed,
        syncedAt: null,
      });

      await saveRespuesta(db, {
        ...key,
        payload: notas("corregido"),
        updatedAtLocal: "2026-01-02T10:00:00.000Z",
      });
      expect(await getPendingRespuestas(db, "t1")).toHaveLength(1);
    });

    it("una sección editada en vuelo sigue pendiente", async () => {
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: notas("lo que viajó"),
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      });

      // El evaluador sigue escribiendo mientras el envío está en el aire.
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: notas("lo que escribió después"),
        updatedAtLocal: "2026-01-01T10:00:02.000Z",
      });

      await markRespuestaSynced(
        db,
        {
          tratamientoId: "t1",
          seccion: "comentarios",
          updatedAtLocal: "2026-01-01T10:00:00.000Z",
        },
        "2026-01-01T10:00:01.000Z",
      );

      expect(await getPendingRespuestas(db, "t1")).toHaveLength(1);
    });
  });

  describe("respuestas de post-cosecha", () => {
    const guardar = (evalId: string, updatedAtLocal: string) =>
      savePostcosechaRespuesta(db, {
        plantId: "p1",
        evalId,
        seccion: "comentarios",
        payload: notas(evalId),
        updatedAtLocal,
      });

    it("el alcance aísla una evaluación de sus tres hermanas", async () => {
      await guardar("15caja", "2026-01-01T10:00:00.000Z");
      await guardar("30plastico", "2026-01-01T09:00:00.000Z");

      expect(await getPendingPostcosechaRespuestas(db)).toHaveLength(2);

      const deUna = await getPendingPostcosechaRespuestas(db, {
        plantId: "p1",
        evalId: "15caja",
      });
      expect(deUna).toHaveLength(1);
      expect(deUna[0].evalId).toBe("15caja");
    });

    it("marcar una no toca las otras", async () => {
      await guardar("15caja", "2026-01-01T10:00:00.000Z");
      await guardar("30caja", "2026-01-01T10:00:00.000Z");

      await markPostcosechaRespuestaSynced(
        db,
        {
          plantId: "p1",
          evalId: "15caja",
          seccion: "comentarios",
          updatedAtLocal: "2026-01-01T10:00:00.000Z",
        },
        "2026-01-01T10:00:01.000Z",
      );

      const pendientes = await getPendingPostcosechaRespuestas(db);
      expect(pendientes).toHaveLength(1);
      expect(pendientes[0].evalId).toBe("30caja");
    });
  });

  describe("fotografías", () => {
    const foto = (
      clientId: string,
      tratamientoId: string,
      capturedAt: string,
    ) =>
      insertFoto(db, {
        clientId,
        tratamientoId,
        categoria: "racimo",
        fileName: `${clientId}.jpg`,
        capturedAt,
      });

    it("salen en el orden en que se capturaron y se filtran por dueño", async () => {
      await foto("f2", "t1", "2026-01-01T11:00:00.000Z");
      await foto("f1", "t1", "2026-01-01T10:00:00.000Z");
      await foto("f3", "t2", "2026-01-01T09:00:00.000Z");

      expect((await getPendingFotos(db)).map((f) => f.clientId)).toEqual([
        "f3",
        "f1",
        "f2",
      ]);
      expect((await getPendingFotos(db, "t1")).map((f) => f.clientId)).toEqual([
        "f1",
        "f2",
      ]);
    });

    it("marcar una la saca de la cola", async () => {
      await foto("f1", "t1", "2026-01-01T10:00:00.000Z");
      await markFotoSynced(db, "f1", "2026-01-01T10:00:01.000Z");

      expect(await getPendingFotos(db, "t1")).toHaveLength(0);
    });

    it("las de post-cosecha se filtran por plantación y evaluación", async () => {
      await insertPostcosechaFoto(db, {
        clientId: "pf1",
        plantId: "p1",
        evalId: "15caja",
        categoria: "racimos",
        fileName: "pf1.jpg",
        capturedAt: "2026-01-01T10:00:00.000Z",
      });
      await insertPostcosechaFoto(db, {
        clientId: "pf2",
        plantId: "p1",
        evalId: "30caja",
        categoria: "racimos",
        fileName: "pf2.jpg",
        capturedAt: "2026-01-01T10:00:00.000Z",
      });

      const deUna = await getPendingPostcosechaFotos(db, {
        plantId: "p1",
        evalId: "15caja",
      });
      expect(deUna.map((f) => f.clientId)).toEqual(["pf1"]);

      await markPostcosechaFotoSynced(db, "pf1", "2026-01-01T10:00:01.000Z");
      expect(await getPendingPostcosechaFotos(db)).toHaveLength(1);
    });
  });

  describe("hasUnsyncedWorkForPlant", () => {
    it("sin captura, no hay nada que proteger", async () => {
      expect(await hasUnsyncedWorkForPlant(db, "p1")).toBe(false);
    });

    // Las cuatro tablas cuentan: la CASCADE de la plantación se las lleva todas,
    // así que cualquiera de ellas con trabajo sin mandar impide el borrado.
    it("mira las cuatro tablas y llega al plantId por el tratamiento", async () => {
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: notas("de t1"),
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      });

      expect(await hasUnsyncedWorkForPlant(db, "p1")).toBe(true);
      expect(await hasUnsyncedWorkForPlant(db, "p2")).toBe(false);

      await insertPostcosechaFoto(db, {
        clientId: "pf1",
        plantId: "p2",
        evalId: "15caja",
        categoria: "racimos",
        fileName: "pf1.jpg",
        capturedAt: "2026-01-01T10:00:00.000Z",
      });
      expect(await hasUnsyncedWorkForPlant(db, "p2")).toBe(true);
    });

    it("deja de contar lo que ya se envió", async () => {
      const key = {
        tratamientoId: "t1",
        seccion: "comentarios" as const,
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      };
      await saveRespuesta(db, { ...key, payload: notas("algo") });
      await markRespuestaSynced(db, key, "2026-01-01T10:00:01.000Z");

      expect(await hasUnsyncedWorkForPlant(db, "p1")).toBe(false);
    });

    // **Lo rechazado es lo que más hay que proteger**: el servidor lo rechazó
    // *porque* la encuesta está cerrada, y está esperando a que la reabran. Al
    // revés que en la cola —donde no entra, para no reintentarse sin fin—, aquí
    // sí cuenta.
    it("una sección rechazada impide el borrado", async () => {
      const key = {
        tratamientoId: "t1",
        seccion: "comentarios" as const,
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      };
      await saveRespuesta(db, { ...key, payload: notas("algo") });
      await markRespuestaRejected(db, key);

      expect(await getPendingRespuestas(db, "t1")).toHaveLength(0);
      expect(await hasUnsyncedWorkForPlant(db, "p1")).toBe(true);
    });

    // El borrado directo no pregunta —quien pregunta es la poda de la
    // descarga—, así que esto sigue comprobando que la CASCADE se lleva la cola.
    it("borrar la plantación se lleva su cola por CASCADE", async () => {
      await savePostcosechaRespuesta(db, {
        plantId: "p1",
        evalId: "15caja",
        seccion: "comentarios",
        payload: notas("algo"),
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      });
      expect(await hasUnsyncedWorkForPlant(db, "p1")).toBe(true);

      await deletePlant(db, "p1");
      expect(await hasUnsyncedWorkForPlant(db, "p1")).toBe(false);
      expect(await getPendingPostcosechaRespuestas(db)).toHaveLength(0);
    });
  });

  describe("hasUnsyncedWorkForTratamiento", () => {
    it("distingue entre hermanos de la misma plantación", async () => {
      await insertFoto(db, {
        clientId: "f1",
        tratamientoId: "t1",
        categoria: "racimo",
        fileName: "f1.jpg",
        capturedAt: "2026-01-01T10:00:00.000Z",
      });

      expect(await hasUnsyncedWorkForTratamiento(db, "t1")).toBe(true);
      expect(await hasUnsyncedWorkForTratamiento(db, "t2")).toBe(false);
    });
  });

  describe("getTratamientoSyncState", () => {
    const brixImposible = {
      cortes: [{ readings: ["99", "", "", "", "", "", "", "", "", ""] }],
    };

    it("sin captura no hay nada pendiente ni nada que revisar", async () => {
      expect(await getTratamientoSyncState(db, "t1")).toEqual({
        captured: 0,
        pending: 0,
        rejected: 0,
        hasError: false,
      });
    });

    it("cuenta las pendientes del tratamiento, no las del vecino", async () => {
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: notas("de t1"),
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      });
      await saveRespuesta(db, {
        tratamientoId: "t2",
        seccion: "comentarios",
        payload: notas("de t2"),
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      });

      expect(await getTratamientoSyncState(db, "t1")).toEqual({
        captured: 1,
        pending: 1,
        rejected: 0,
        hasError: false,
      });
    });

    it("una sola sección con un dato imposible marca el tratamiento", async () => {
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: notas("esto está bien"),
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      });
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "brix",
        payload: brixImposible,
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      });

      expect(await getTratamientoSyncState(db, "t1")).toEqual({
        captured: 2,
        pending: 2,
        rejected: 0,
        hasError: true,
      });
    });

    // `captured` es lo que distingue «ya se mandó todo» de «no hay nada»: sin
    // él, una captura en blanco diría «Sincronizado» de entrada.
    it("cuenta también las fotografías, que son del mismo dueño", async () => {
      await insertFoto(db, {
        clientId: "f1",
        tratamientoId: "t1",
        categoria: "racimo",
        fileName: "f1.jpg",
        capturedAt: "2026-01-01T10:00:00.000Z",
      });

      expect(await getTratamientoSyncState(db, "t1")).toEqual({
        captured: 1,
        pending: 1,
        rejected: 0,
        hasError: false,
      });
    });

    // Lo que hace seguro el dato derivado: lo calcula el propio guardado, así
    // que corregir la lectura limpia la marca sin que nadie se acuerde.
    it("corregir la lectura quita la marca", async () => {
      const key = {
        tratamientoId: "t1",
        seccion: "brix" as const,
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      };
      await saveRespuesta(db, { ...key, payload: brixImposible });
      expect((await getTratamientoSyncState(db, "t1")).hasError).toBe(true);

      await saveRespuesta(db, {
        ...key,
        payload: {
          cortes: [{ readings: ["18", "", "", "", "", "", "", "", "", ""] }],
        },
      });
      expect((await getTratamientoSyncState(db, "t1")).hasError).toBe(false);
    });
  });
});
