import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import { buildTratamiento } from "@/test-utils/factories/tratamiento.factory";
import { SyncStatus, type PlantRecord } from "../../../types";
import {
  deletePlant,
  getPlantIdsWithPendingWork,
  upsertPlant,
} from "../plants.repository";
import { upsertTratamiento } from "../tratamientos.repository";
import {
  getPendingRespuestas,
  getTratamientoSyncState,
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

  describe("getPlantIdsWithPendingWork", () => {
    it("sin captura, ninguna plantación tiene nada que mandar", async () => {
      expect(await getPlantIdsWithPendingWork(db)).toEqual(new Set());
    });

    // Las cuatro tablas cuentan, porque el evaluador no distingue entre ellas:
    // lo que pregunta es si le falta mandar algo de esa plantación.
    it("cuenta las cuatro tablas y llega al plantId por el tratamiento", async () => {
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: notas("de t1"),
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      });
      expect(await getPlantIdsWithPendingWork(db)).toEqual(new Set(["p1"]));

      await insertFoto(db, {
        clientId: "f1",
        tratamientoId: "t2",
        categoria: "racimo",
        fileName: "f1.jpg",
        capturedAt: "2026-01-01T10:00:00.000Z",
      });
      expect(await getPlantIdsWithPendingWork(db)).toEqual(
        new Set(["p1", "p2"]),
      );
    });

    it("deja de contar lo que ya se envió", async () => {
      const key = {
        tratamientoId: "t1",
        seccion: "comentarios" as const,
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      };
      await saveRespuesta(db, { ...key, payload: notas("algo") });
      await markRespuestaSynced(db, key, "2026-01-01T10:00:01.000Z");

      expect(await getPlantIdsWithPendingWork(db)).toEqual(new Set());
    });

    // Una encuesta cerrada no se arregla reintentando, así que contarla dejaría
    // la tarjeta en «Pendiente» para siempre sin que nadie pudiera quitarlo.
    it("una sección rechazada no cuenta como pendiente", async () => {
      const key = {
        tratamientoId: "t1",
        seccion: "comentarios" as const,
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      };
      await saveRespuesta(db, { ...key, payload: notas("algo") });
      await markRespuestaRejected(db, key);

      expect(await getPlantIdsWithPendingWork(db)).toEqual(new Set());
    });

    it("la CASCADE se lleva la cola de la plantación borrada", async () => {
      await savePostcosechaRespuesta(db, {
        plantId: "p1",
        evalId: "15caja",
        seccion: "comentarios",
        payload: notas("algo"),
        updatedAtLocal: "2026-01-01T10:00:00.000Z",
      });
      expect(await getPlantIdsWithPendingWork(db)).toEqual(new Set(["p1"]));

      await deletePlant(db, "p1");
      expect(await getPlantIdsWithPendingWork(db)).toEqual(new Set());
    });
  });

  describe("getTratamientoSyncState", () => {
    const brixImposible = {
      cortes: [{ readings: ["99", "", "", "", "", "", "", "", "", ""] }],
    };

    it("sin captura no hay nada pendiente ni nada que revisar", async () => {
      expect(await getTratamientoSyncState(db, "t1")).toEqual({
        pending: 0,
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
        pending: 1,
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
        pending: 2,
        hasError: true,
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
