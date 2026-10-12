import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import { buildTratamiento } from "@/test-utils/factories/tratamiento.factory";
import { SyncStatus, type PlantRecord } from "../../types";
import { upsertPlant } from "../../lib/db/plants.repository";
import { upsertTratamiento } from "../../lib/db/tratamientos.repository";
import {
  getPendingRespuestas,
  saveRespuesta,
} from "../../lib/db/respuestas.repository";
import {
  getPendingPostcosechaRespuestas,
  savePostcosechaRespuesta,
} from "../../lib/db/postcosecha-respuestas.repository";
import { createComentarios } from "../../lib/comentarios";
import { buildFrutaDefaults } from "../../lib/postcosecha-fruta";
import {
  pushPostcosechaRespuestas,
  pushTratamientoRespuestas,
} from "../use-sync-item";
import {
  pushPostcosechaBatch,
  pushRespuestasBatch,
} from "../../api/respuestas.api";

// Con fábrica y no `jest.mock(path)` a secas: el automock **requiere** el módulo
// real para sacarle la forma, y por ahí entra `api-client` → `auth-store` →
// AsyncStorage, que necesita su mock nativo. La fábrica corta esa cadena, que es
// justo lo que hace que este test corra sin tocar nada de red ni de plataforma.
jest.mock("../../api/respuestas.api", () => ({
  pushRespuestasBatch: jest.fn(),
  pushPostcosechaBatch: jest.fn(),
}));

const mockPush = pushRespuestasBatch as jest.MockedFunction<
  typeof pushRespuestasBatch
>;
const mockPushPc = pushPostcosechaBatch as jest.MockedFunction<
  typeof pushPostcosechaBatch
>;

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

const notas = (positivos: string) => ({ ...createComentarios(), positivos });

const AYER = "2026-01-01T10:00:00.000Z";

describe("el envío de un item", () => {
  let db: SQLiteDatabase;

  const estado = (seccion: string) =>
    db.getFirstAsync<{ syncStatus: string; syncedAt: string | null }>(
      "SELECT syncStatus, syncedAt FROM respuestas WHERE tratamientoId = ? AND seccion = ?",
      ["t1", seccion],
    );

  beforeEach(async () => {
    jest.clearAllMocks();
    db = createInMemoryDb();
    await runMigrations(db);
    await upsertPlant(db, buildRecord({ id: "p1" }));
    await upsertTratamiento(db, buildTratamiento({ id: "t1", plantId: "p1" }));
  });

  describe("tratamiento", () => {
    it("manda el cuerpo del contrato y marca lo aceptado", async () => {
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: notas("Buena uniformidad."),
        updatedAtLocal: AYER,
      });
      mockPush.mockResolvedValue({
        results: [
          { evaluacion_id: "t1", seccion: "comentarios", status: "ok" },
        ],
      });

      const report = await pushTratamientoRespuestas(db, "t1");

      // El `evaluacion_id` es el id del tratamiento local, que es el de la fila
      // `EvaluacionTratamiento` del servidor: el mismo id con dos nombres.
      expect(mockPush).toHaveBeenCalledWith([
        {
          evaluacion_id: "t1",
          seccion: "comentarios",
          capturado_en: AYER,
          payload: {
            positivos: "Buena uniformidad.",
            negativos: "",
            observaciones: "",
          },
        },
      ]);
      expect(report).toEqual({
        enviadas: 1,
        rechazadas: 0,
        pendientes: 0,
        blocked: false,
      });
      expect(await estado("comentarios")).toEqual({
        syncStatus: SyncStatus.synced,
        syncedAt: expect.any(String),
      });
    });

    it("un rechazo no arrastra al resto del lote", async () => {
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: notas("algo"),
        updatedAtLocal: AYER,
      });
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "exterior",
        payload: { forma_racimo: "conical" },
        updatedAtLocal: AYER,
      });
      mockPush.mockResolvedValue({
        results: [
          { evaluacion_id: "t1", seccion: "comentarios", status: "ok" },
          {
            evaluacion_id: "t1",
            seccion: "exterior",
            status: "error",
            code: "encuesta_cerrada",
          },
        ],
      });

      const report = await pushTratamientoRespuestas(db, "t1");

      expect(report).toMatchObject({ enviadas: 1, rechazadas: 1 });
      expect(await estado("comentarios")).toMatchObject({
        syncStatus: SyncStatus.synced,
      });
      // Sale de la cola, pero `syncedAt` sigue en null: no llegó a ningún sitio.
      expect(await estado("exterior")).toEqual({
        syncStatus: SyncStatus.rejected_closed,
        syncedAt: null,
      });
      expect(await getPendingRespuestas(db, "t1")).toHaveLength(0);
    });

    it("lo que el servidor no contestó sigue pendiente", async () => {
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: notas("algo"),
        updatedAtLocal: AYER,
      });
      mockPush.mockResolvedValue({ results: [] });

      const report = await pushTratamientoRespuestas(db, "t1");

      expect(report).toMatchObject({ enviadas: 0, pendientes: 1 });
      expect(await getPendingRespuestas(db, "t1")).toHaveLength(1);
    });

    // La carrera de verdad: el evaluador sigue escribiendo mientras el envío
    // está en el aire. Sin el guardia del `updatedAtLocal`, ese cambio quedaría
    // marcado como sincronizado sin haber salido nunca de la tablet.
    it("una sección editada en vuelo no se marca como enviada", async () => {
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: notas("lo que viajó"),
        updatedAtLocal: AYER,
      });

      mockPush.mockImplementation(async () => {
        await saveRespuesta(db, {
          tratamientoId: "t1",
          seccion: "comentarios",
          payload: notas("lo que escribió después"),
          updatedAtLocal: "2026-01-01T10:00:02.000Z",
        });
        return {
          results: [
            { evaluacion_id: "t1", seccion: "comentarios", status: "ok" },
          ],
        };
      });

      await pushTratamientoRespuestas(db, "t1");

      expect(await getPendingRespuestas(db, "t1")).toHaveLength(1);
      expect(await estado("comentarios")).toMatchObject({
        syncStatus: SyncStatus.pending,
      });
    });

    it("un dato imposible bloquea el item y no toca la red", async () => {
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "comentarios",
        payload: notas("esto sí se podría mandar"),
        updatedAtLocal: AYER,
      });
      // Una lectura fuera de 14.5–30 °Brix: imposible, no raro.
      await saveRespuesta(db, {
        tratamientoId: "t1",
        seccion: "brix",
        payload: {
          cortes: [{ readings: ["99", "", "", "", "", "", "", "", "", ""] }],
        },
        updatedAtLocal: AYER,
      });

      const report = await pushTratamientoRespuestas(db, "t1");

      expect(report.blocked).toBe(true);
      expect(mockPush).not.toHaveBeenCalled();
      expect(await getPendingRespuestas(db, "t1")).toHaveLength(2);
    });

    it("sin nada que mandar no se hace una petición vacía", async () => {
      const report = await pushTratamientoRespuestas(db, "t1");

      expect(mockPush).not.toHaveBeenCalled();
      expect(report).toEqual({
        enviadas: 0,
        rechazadas: 0,
        pendientes: 0,
        blocked: false,
      });
    });
  });

  describe("post-cosecha", () => {
    it("manda solo la evaluación pedida, con su llave de tres partes", async () => {
      for (const evalId of ["15caja", "30plastico"]) {
        await savePostcosechaRespuesta(db, {
          plantId: "p1",
          evalId,
          seccion: "fruta",
          payload: { ...buildFrutaDefaults(), peso_inicial: "8002.5" },
          updatedAtLocal: AYER,
        });
      }
      mockPushPc.mockResolvedValue({
        results: [
          {
            plantacion_id: "p1",
            eval_id: "15caja",
            seccion: "fruta",
            status: "ok",
          },
        ],
      });

      const report = await pushPostcosechaRespuestas(db, "p1", "15caja");

      expect(mockPushPc).toHaveBeenCalledWith([
        expect.objectContaining({
          plantacion_id: "p1",
          eval_id: "15caja",
          seccion: "fruta",
          capturado_en: AYER,
        }),
      ]);
      // Los pesos cruzan a número en el mapper, no en el guardado.
      expect(mockPushPc.mock.calls[0][0][0].payload).toMatchObject({
        peso_inicial: 8002.5,
        peso_final: null,
      });
      expect(report).toMatchObject({ enviadas: 1 });

      // La hermana no se tocó.
      const pendientes = await getPendingPostcosechaRespuestas(db);
      expect(pendientes.map((r) => r.evalId)).toEqual(["30plastico"]);
    });
  });
});
