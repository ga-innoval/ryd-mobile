import { SyncStatus, type RespuestaRecord } from "../../types";
import { buildEvaluationFromRespuestas } from "../build-evaluation-from-respuestas";
import { buildEvaluationDefaults } from "../evaluation-schema";
import { createComentarios } from "../comentarios";
import { CRIBA_CALIBRES } from "../criba";

const buildRespuesta = (
  overrides: Partial<RespuestaRecord> & Pick<RespuestaRecord, "seccion">,
): RespuestaRecord => ({
  tratamientoId: "t1",
  payload: {},
  syncStatus: SyncStatus.pending,
  updatedAtLocal: "2026-09-24T14:00:00.000Z",
  syncedAt: null,
  ...overrides,
});

describe("buildEvaluationFromRespuestas", () => {
  it("sin nada guardado devuelve la evaluación en blanco", () => {
    expect(buildEvaluationFromRespuestas([])).toEqual(
      buildEvaluationDefaults(),
    );
  });

  it("superpone lo capturado y deja el resto en blanco", () => {
    const comentarios = {
      ...createComentarios(),
      positivos: "Buena uniformidad.",
    };

    const values = buildEvaluationFromRespuestas([
      buildRespuesta({ seccion: "comentarios", payload: comentarios }),
    ]);

    expect(values.comentarios).toEqual(comentarios);
    // La estructura vacía de las demás sigue ahí: la pantalla necesita sus
    // nueve calibres y su primer corte para poder pintarlas.
    expect(values.criba.calibres).toHaveLength(CRIBA_CALIBRES.length);
    expect(values.brix.cortes).toHaveLength(1);
  });

  it("conserva las lecturas como texto, no como número", () => {
    const values = buildEvaluationFromRespuestas([
      buildRespuesta({
        seccion: "brix",
        payload: {
          cortes: [
            { readings: ["14.5", "14.", "", "", "", "", "", "", "", ""] },
          ],
        },
      }),
    ]);

    // Lo tecleado vuelve tal cual: un "14." a medio escribir no es un número y
    // el formulario tiene que enseñar exactamente lo que había.
    expect(values.brix.cortes[0].readings[1]).toBe("14.");
  });

  it("deja en blanco la sección cuyo payload no encaja, sin reventar", () => {
    const values = buildEvaluationFromRespuestas([
      buildRespuesta({
        seccion: "criba",
        // Formato viejo: tres calibres donde el esquema espera nueve.
        payload: { calibres: [{ total: "1", average: "1" }] },
      }),
    ]);

    expect(values.criba).toEqual(buildEvaluationDefaults().criba);
  });

  it("ignora una sección que ya no existe en el formulario", () => {
    const values = buildEvaluationFromRespuestas([
      buildRespuesta({
        seccion: "post_cosecha" as RespuestaRecord["seccion"],
        payload: { lo: "que sea" },
      }),
    ]);

    expect(values).toEqual(buildEvaluationDefaults());
  });

  it("no mezcla dos secciones distintas", () => {
    const values = buildEvaluationFromRespuestas([
      buildRespuesta({
        seccion: "exterior",
        payload: { forma_racimo: "hairy" },
      }),
      buildRespuesta({ seccion: "interior", payload: { acidez: "low" } }),
    ]);

    expect(values.exterior).toEqual({ forma_racimo: "hairy" });
    expect(values.interior).toEqual({ acidez: "low" });
  });
});
