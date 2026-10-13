import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import { buildTratamiento } from "@/test-utils/factories/tratamiento.factory";
import type { PlantRecord } from "../../types";
import { upsertPlant } from "../../lib/db/plants.repository";
import { upsertTratamiento } from "../../lib/db/tratamientos.repository";
import {
  getPendingRespuestas,
  saveRespuesta,
} from "../../lib/db/respuestas.repository";
import {
  getPendingFotos,
  insertFoto,
} from "../../lib/db/respuesta-fotos.repository";
import { savePostcosechaRespuesta } from "../../lib/db/postcosecha-respuestas.repository";
import { createComentarios } from "../../lib/comentarios";
import { pushAll } from "../use-sync-all";
import {
  pushPostcosechaBatch,
  pushRespuestasBatch,
} from "../../api/respuestas.api";
import { uploadFoto } from "../../api/foto-upload.api";

jest.mock("../../api/respuestas.api", () => ({
  pushRespuestasBatch: jest.fn(),
  pushPostcosechaBatch: jest.fn(),
}));
jest.mock("../../api/foto-upload.api", () => ({
  uploadFoto: jest.fn(),
  uploadPostcosechaFoto: jest.fn(),
}));

const mockPush = pushRespuestasBatch as jest.MockedFunction<
  typeof pushRespuestasBatch
>;
const mockPushPc = pushPostcosechaBatch as jest.MockedFunction<
  typeof pushPostcosechaBatch
>;
const mockUpload = uploadFoto as jest.MockedFunction<typeof uploadFoto>;

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

const notas = (positivos: string) => ({ ...createComentarios(), positivos });
const AYER = "2026-01-01T10:00:00.000Z";

/** Una lectura fuera de 14.5–30 °Brix: imposible, no rara. */
const BRIX_IMPOSIBLE = {
  cortes: [{ readings: ["99", "", "", "", "", "", "", "", "", ""] }],
};

describe("sincronizar todo", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPush.mockResolvedValue({ results: [] });
    mockPushPc.mockResolvedValue({ results: [] });
    mockUpload.mockResolvedValue({ kind: "ok" });

    db = createInMemoryDb();
    await runMigrations(db);
    await upsertPlant(db, buildRecord({ id: "p1" }));
    await upsertPlant(db, buildRecord({ id: "p2", name: "Otra" }));
    await upsertTratamiento(db, buildTratamiento({ id: "t1", plantId: "p1" }));
    await upsertTratamiento(db, buildTratamiento({ id: "t2", plantId: "p2" }));
  });

  // Veinte plantaciones de cuatro tratamientos serían ochenta peticiones, y en
  // campo lo escaso es la conexión.
  it("manda todo en un solo lote por encuesta, no uno por captura", async () => {
    for (const tratamientoId of ["t1", "t2"]) {
      await saveRespuesta(db, {
        tratamientoId,
        seccion: "comentarios",
        payload: notas(tratamientoId),
        updatedAtLocal: AYER,
      });
    }
    await savePostcosechaRespuesta(db, {
      plantId: "p1",
      evalId: "15caja",
      seccion: "comentarios",
      payload: notas("post-cosecha"),
      updatedAtLocal: AYER,
    });

    await pushAll(db);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0][0]).toHaveLength(2);
    expect(mockPushPc).toHaveBeenCalledTimes(1);
    expect(mockPushPc.mock.calls[0][0]).toHaveLength(1);
  });

  // La regla del botón de cada pantalla, aplicada a todas a la vez: el error
  // bloquea su captura entera y **las demás viajan igual**.
  it("deja fuera la captura con un dato imposible y manda el resto", async () => {
    await saveRespuesta(db, {
      tratamientoId: "t1",
      seccion: "comentarios",
      payload: notas("esta sí sale"),
      updatedAtLocal: AYER,
    });
    await saveRespuesta(db, {
      tratamientoId: "t2",
      seccion: "comentarios",
      payload: notas("esta no, su hermana falla"),
      updatedAtLocal: AYER,
    });
    await saveRespuesta(db, {
      tratamientoId: "t2",
      seccion: "brix",
      payload: BRIX_IMPOSIBLE,
      updatedAtLocal: AYER,
    });
    mockPush.mockResolvedValue({
      results: [{ evaluacion_id: "t1", seccion: "comentarios", status: "ok" }],
    });

    const report = await pushAll(db);

    expect(mockPush.mock.calls[0][0].map((i) => i.evaluacion_id)).toEqual([
      "t1",
    ]);
    expect(report).toMatchObject({ enviadas: 1, bloqueadas: 1 });
    // Las dos secciones del bloqueado siguen esperando.
    expect(await getPendingRespuestas(db, "t2")).toHaveLength(2);
  });

  it("tampoco sube las fotografías de lo bloqueado", async () => {
    await saveRespuesta(db, {
      tratamientoId: "t2",
      seccion: "brix",
      payload: BRIX_IMPOSIBLE,
      updatedAtLocal: AYER,
    });
    for (const [clientId, tratamientoId] of [
      ["f1", "t1"],
      ["f2", "t2"],
    ]) {
      await insertFoto(db, {
        clientId,
        tratamientoId,
        categoria: "racimo",
        fileName: `${clientId}.jpg`,
        capturedAt: AYER,
      });
    }

    const report = await pushAll(db);

    expect(mockUpload.mock.calls.map(([f]) => f.clientId)).toEqual(["f1"]);
    expect(report).toMatchObject({ fotos: 1, bloqueadas: 1 });
    expect((await getPendingFotos(db)).map((f) => f.clientId)).toEqual(["f2"]);
  });

  // Un dueño con seis secciones y tres fotos esperando es **una** captura que
  // se quedó fuera, no nueve.
  it("cuenta cada captura bloqueada una sola vez", async () => {
    await saveRespuesta(db, {
      tratamientoId: "t2",
      seccion: "brix",
      payload: BRIX_IMPOSIBLE,
      updatedAtLocal: AYER,
    });
    await saveRespuesta(db, {
      tratamientoId: "t2",
      seccion: "comentarios",
      payload: notas("otra sección del mismo"),
      updatedAtLocal: AYER,
    });
    await insertFoto(db, {
      clientId: "f2",
      tratamientoId: "t2",
      categoria: "racimo",
      fileName: "f2.jpg",
      capturedAt: AYER,
    });

    expect(await pushAll(db)).toMatchObject({ bloqueadas: 1 });
  });

  it("sin nada que mandar no toca la red", async () => {
    const report = await pushAll(db);

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPushPc).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(report).toMatchObject({ enviadas: 0, fotos: 0, bloqueadas: 0 });
  });
});
