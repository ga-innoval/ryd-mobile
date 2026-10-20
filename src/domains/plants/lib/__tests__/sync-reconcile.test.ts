import type { BatchResult } from "../../api/types";
import type { SentRespuestaKey } from "../db/respuestas.repository";
import {
  reconcilePostcosecha,
  reconcileRespuestas,
  TERMINAL_REJECTIONS,
} from "../sync-reconcile";

const enviada = (
  seccion: SentRespuestaKey["seccion"],
  tratamientoId = "t1",
): SentRespuestaKey => ({
  tratamientoId,
  seccion,
  updatedAtLocal: `2026-01-01T10:00:00.000Z`,
});

const ok = (seccion: string, evaluacion_id = "t1"): BatchResult => ({
  evaluacion_id,
  seccion,
  status: "ok",
});

describe("reconcileRespuestas", () => {
  it("lo que el servidor aceptó se marca, y nada más", () => {
    const sent = [enviada("brix"), enviada("criba")];
    const outcome = reconcileRespuestas(sent, [ok("brix"), ok("criba")]);

    expect(outcome.synced).toEqual(sent);
    expect(outcome.rejected).toEqual([]);
    expect(outcome.retry).toEqual([]);
    expect(outcome.stray).toBe(0);
  });

  // Este es el test que de verdad importa. Emparejar por posición marcaría
  // `brix` como enviada cuando el `ok` era de `criba`, y eso es silencioso e
  // irreparable: nadie vuelve a mandar una sección que se dio por enviada.
  it("empareja por llave y no por posición, aunque el servidor reordene", () => {
    const brix = enviada("brix");
    const criba = enviada("criba");

    const outcome = reconcileRespuestas(
      [brix, criba],
      [
        { ...ok("criba") },
        { evaluacion_id: "t1", seccion: "brix", status: "error" },
      ],
    );

    expect(outcome.synced).toEqual([criba]);
    expect(outcome.retry).toEqual([brix]);
  });

  it("no mezcla dos tratamientos con la misma sección", () => {
    const deT1 = enviada("brix", "t1");
    const deT2 = enviada("brix", "t2");

    const outcome = reconcileRespuestas([deT1, deT2], [ok("brix", "t2")]);

    expect(outcome.synced).toEqual([deT2]);
    expect(outcome.retry).toEqual([deT1]);
  });

  it("lo que el servidor no contestó se queda pendiente, no enviado", () => {
    const sent = [enviada("brix"), enviada("criba")];
    const outcome = reconcileRespuestas(sent, [ok("brix")]);

    expect(outcome.synced).toEqual([enviada("brix")]);
    expect(outcome.retry).toEqual([enviada("criba")]);
  });

  it("un código terminal saca la sección de la cola", () => {
    const outcome = reconcileRespuestas(
      [enviada("brix")],
      [
        {
          evaluacion_id: "t1",
          seccion: "brix",
          status: "error",
          code: "encuesta_cerrada",
        },
      ],
    );

    expect(outcome.rejected).toEqual([enviada("brix")]);
    expect(outcome.retry).toEqual([]);
  });

  // Un código que esta versión de la app no conoce se reintenta. Al revés, el
  // día que el servidor añada uno enterraría capturas en un estado del que
  // nadie las saca.
  it("un código desconocido se reintenta, no se entierra", () => {
    const outcome = reconcileRespuestas(
      [enviada("brix")],
      [
        {
          evaluacion_id: "t1",
          seccion: "brix",
          status: "error",
          code: "limite_de_cuota",
        },
      ],
    );

    expect(outcome.rejected).toEqual([]);
    expect(outcome.retry).toEqual([enviada("brix")]);
  });

  it("un error sin código también se reintenta", () => {
    const outcome = reconcileRespuestas(
      [enviada("brix")],
      [{ evaluacion_id: "t1", seccion: "brix", status: "error" }],
    );

    expect(outcome.retry).toEqual([enviada("brix")]);
  });

  it("un resultado de más se cuenta y no hunde el lote", () => {
    const outcome = reconcileRespuestas(
      [enviada("brix")],
      [ok("brix"), ok("rendimiento"), ok("brix")],
    );

    expect(outcome.synced).toEqual([enviada("brix")]);
    expect(outcome.stray).toBe(2);
  });

  it("sin nada enviado no hay nada que reconciliar", () => {
    expect(reconcileRespuestas([], [])).toEqual({
      synced: [],
      rejected: [],
      retry: [],
      stray: 0,
    });
  });
});

describe("reconcilePostcosecha", () => {
  const enviadaPc = (evalId: string) => ({
    plantId: "p1",
    evalId,
    seccion: "fruta" as const,
    updatedAtLocal: "2026-01-01T10:00:00.000Z",
  });

  // La llave es de tres partes: con dos, «fruta de 15caja» y «fruta de 30caja»
  // serían la misma, y saltar entre chips mientras algo sube es la navegación
  // normal de esa pantalla.
  it("distingue las cuatro evaluaciones de una misma plantación", () => {
    const outcome = reconcilePostcosecha(
      [enviadaPc("15caja"), enviadaPc("30caja")],
      [
        {
          plantacion_id: "p1",
          eval_id: "30caja",
          seccion: "fruta",
          status: "ok",
        },
      ],
    );

    expect(outcome.synced).toEqual([enviadaPc("30caja")]);
    expect(outcome.retry).toEqual([enviadaPc("15caja")]);
  });
});

describe("TERMINAL_REJECTIONS", () => {
  // Agregar uno es un cambio en los dos lados, así que la lista se mira aquí.
  it("hoy son terminales la encuesta cerrada y la de otro usuario", () => {
    expect(TERMINAL_REJECTIONS).toEqual([
      "encuesta_cerrada",
      "encuesta_de_otro_usuario",
    ]);
  });
});
