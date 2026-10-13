import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import { buildTratamiento } from "@/test-utils/factories/tratamiento.factory";
import type { PlantRecord } from "../../types";
import type { SyncUnit } from "../../lib/sync-progress";
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

  // Una tanda por plantación: es lo que hace cierto el «plantación 3 de 10» del
  // aviso. Dentro de cada una sí se agrupa — sus secciones van en un lote.
  it("manda una tanda por plantación, agrupando sus secciones", async () => {
    for (const tratamientoId of ["t1", "t2"]) {
      await saveRespuesta(db, {
        tratamientoId,
        seccion: "comentarios",
        payload: notas(tratamientoId),
        updatedAtLocal: AYER,
      });
      await saveRespuesta(db, {
        tratamientoId,
        seccion: "exterior",
        payload: { forma_racimo: "conical" },
        updatedAtLocal: AYER,
      });
    }

    await pushAll(db);

    // Dos plantaciones, dos peticiones; dos secciones cada una, en su lote.
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush.mock.calls[0][0]).toHaveLength(2);
    expect(mockPush.mock.calls[1][0]).toHaveLength(2);
  });

  it("va avisando por cuál plantación va", async () => {
    for (const tratamientoId of ["t1", "t2"]) {
      await saveRespuesta(db, {
        tratamientoId,
        seccion: "comentarios",
        payload: notas(tratamientoId),
        updatedAtLocal: AYER,
      });
    }
    const avisos: [number, number][] = [];

    await pushAll(db, ({ done, total }) => avisos.push([done, total]));

    // Avisa en cada transición de cada renglón, no solo al cambiar de
    // plantación: el primero es la lista recién nacida y el último, el final.
    expect(avisos[0]).toEqual([0, 2]);
    expect(avisos[avisos.length - 1]).toEqual([2, 2]);
  });

  // La lista nace entera para que el aviso no crezca renglón a renglón, con lo
  // que falta en gris.
  it("la lista nace completa, con un renglón por plantación", async () => {
    await saveRespuesta(db, {
      tratamientoId: "t1",
      seccion: "comentarios",
      payload: notas("de t1"),
      updatedAtLocal: AYER,
    });
    await insertFoto(db, {
      clientId: "f1",
      tratamientoId: "t1",
      categoria: "racimo",
      fileName: "f1.jpg",
      capturedAt: AYER,
    });
    let primera: SyncUnit[] = [];

    await pushAll(db, ({ units }) => {
      if (primera.length === 0) primera = units;
    });

    // Uno solo por plantación, y con la fila entera: el renglón la identifica
    // con los mismos cinco datos que el encabezado de su tarjeta.
    expect(primera).toEqual([
      expect.objectContaining({
        id: "p1",
        status: "pending",
        plant: expect.objectContaining({
          id: "p1",
          name: "1004-Freedom",
          cuadro: "1A",
        }),
      }),
    ]);
  });

  it("al acabar, cada renglón dice en qué quedó", async () => {
    await saveRespuesta(db, {
      tratamientoId: "t1",
      seccion: "comentarios",
      payload: notas("de t1"),
      updatedAtLocal: AYER,
    });
    mockPush.mockResolvedValue({
      results: [{ evaluacion_id: "t1", seccion: "comentarios", status: "ok" }],
    });
    let ultima: SyncUnit[] = [];

    await pushAll(db, ({ units }) => {
      ultima = units;
    });

    expect(ultima).toEqual([
      expect.objectContaining({ id: "p1", status: "done" }),
    ]);
  });

  // Sin esto, una captura bloqueada desaparecería de la lista y el aviso diría
  // «1 de 2» sin enseñar cuál faltó.
  it("lo bloqueado sale en la lista, no desaparece", async () => {
    await saveRespuesta(db, {
      tratamientoId: "t2",
      seccion: "brix",
      payload: BRIX_IMPOSIBLE,
      updatedAtLocal: AYER,
    });
    let ultima: SyncUnit[] = [];

    await pushAll(db, ({ units }) => {
      ultima = units;
    });

    expect(ultima).toEqual([
      expect.objectContaining({ id: "p2", status: "blocked" }),
    ]);
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

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0][0].map((i) => i.evaluacion_id)).toEqual([
      "t1",
    ]);
    // La bloqueada cuenta como plantación de la tanda: si no, parecería que no
    // había nada que hacer con ella.
    expect(report).toEqual({
      plantaciones: 2,
      sincronizadas: 1,
      bloqueadas: 1,
    });
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
    expect(report).toMatchObject({ sincronizadas: 1, bloqueadas: 1 });
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

  // Lo rechazado por encuesta cerrada no sale nunca, así que su plantación no
  // cuenta como sincronizada — que es lo que el aviso tiene que poder decir.
  it("una sección rechazada deja su plantación sin sincronizar", async () => {
    await saveRespuesta(db, {
      tratamientoId: "t1",
      seccion: "comentarios",
      payload: notas("algo"),
      updatedAtLocal: AYER,
    });
    mockPush.mockResolvedValue({
      results: [
        {
          evaluacion_id: "t1",
          seccion: "comentarios",
          status: "error",
          code: "encuesta_cerrada",
        },
      ],
    });

    expect(await pushAll(db)).toEqual({
      plantaciones: 1,
      sincronizadas: 0,
      bloqueadas: 0,
    });
  });

  // Seguir con las nueve restantes serían noventa segundos de timeout para
  // acabar igual.
  it("sin red corta la tanda en vez de reintentar una por una", async () => {
    for (const tratamientoId of ["t1", "t2"]) {
      await saveRespuesta(db, {
        tratamientoId,
        seccion: "comentarios",
        payload: notas(tratamientoId),
        updatedAtLocal: AYER,
      });
    }
    mockPush.mockRejectedValue({ request: {}, response: undefined });

    await expect(pushAll(db)).rejects.toBeDefined();
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  // Un 500 en una plantación no puede impedir que lleguen las demás.
  it("un fallo del servidor no detiene a las otras plantaciones", async () => {
    for (const tratamientoId of ["t1", "t2"]) {
      await saveRespuesta(db, {
        tratamientoId,
        seccion: "comentarios",
        payload: notas(tratamientoId),
        updatedAtLocal: AYER,
      });
    }
    mockPush.mockRejectedValueOnce({ request: {}, response: { status: 500 } });
    mockPush.mockResolvedValue({
      results: [{ evaluacion_id: "t2", seccion: "comentarios", status: "ok" }],
    });

    const report = await pushAll(db);

    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(report).toMatchObject({ plantaciones: 2, sincronizadas: 1 });
  });

  it("sin nada que mandar no toca la red", async () => {
    const report = await pushAll(db);

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPushPc).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(report).toEqual({
      plantaciones: 0,
      sincronizadas: 0,
      bloqueadas: 0,
    });
  });
});
