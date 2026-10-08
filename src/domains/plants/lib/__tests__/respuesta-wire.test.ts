import { CRIBA_CALIBRES, CRIBA_MAX_CALIBRES } from "../criba";
import {
  buildEvaluationDefaults,
  evaluationSchema,
} from "../evaluation-schema";
import { toRespuestaWirePayload } from "../respuesta-wire";

const defaults = buildEvaluationDefaults();

describe("toRespuestaWirePayload", () => {
  describe("exterior e interior", () => {
    it("manda todas las preguntas del catálogo, las no contestadas en null", () => {
      const wire = toRespuestaWirePayload("exterior", {
        susceptibilidad_quemaduras_sol: "high",
      });

      const ids = Object.keys(evaluationSchema.shape.exterior.shape);
      expect(Object.keys(wire!)).toHaveLength(ids.length);
      expect(wire).toMatchObject({
        susceptibilidad_quemaduras_sol: "high",
        forma_racimo: null,
      });
    });

    it("viaja el slug, nunca la etiqueta visible", () => {
      const wire = toRespuestaWirePayload("interior", defaults.interior);
      expect(Object.values(wire!).every((value) => value === null)).toBe(true);
    });
  });

  describe("brix", () => {
    it("numera los cortes desde 1 y pasa las lecturas a número", () => {
      const wire = toRespuestaWirePayload("brix", {
        cortes: [
          { readings: ["14.5", "14.2", "", "", "", "", "", "", "", ""] },
          { readings: ["15", "", "", "", "", "", "", "", "", ""] },
        ],
      });

      expect(wire).toEqual({
        cortes: [
          {
            numero: 1,
            lecturas: [
              14.5,
              14.2,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
            ],
          },
          {
            numero: 2,
            lecturas: [
              15,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
            ],
          },
        ],
      });
    });

    // Lo que de verdad hay en SQLite a medio teclear. "14." sí es un número
    // —`Number("14.")` es 14—; lo que no lo es se va en `null`, que es "sin
    // capturar" y no un cero.
    it("un decimal a medio teclear no tumba el mapeo", () => {
      const wire = toRespuestaWirePayload("brix", {
        cortes: [{ readings: ["14.", ".", "", "", "", "", "", "", "", ""] }],
      }) as { cortes: { lecturas: (number | null)[] }[] };

      expect(wire.cortes[0].lecturas.slice(0, 2)).toEqual([14, null]);
    });

    it("un payload que no encaja no se manda", () => {
      // La pantalla arranca con un corte y no deja descartar el único, así que
      // un array vacío solo puede venir de otra versión del formulario.
      expect(toRespuestaWirePayload("brix", { cortes: [] })).toBeNull();
      expect(toRespuestaWirePayload("brix", {})).toBeNull();
    });
  });

  describe("criba", () => {
    it("identifica cada calibre por su numerador sobre 16", () => {
      const wire = toRespuestaWirePayload("criba", defaults.criba) as {
        calibres: { calibre: number }[];
      };

      expect(wire.calibres).toHaveLength(CRIBA_CALIBRES.length);
      expect(wire.calibres.map((c) => c.calibre)).toEqual([
        8, 9, 10, 11, 12, 13, 14, 15, 16,
      ]);
    });

    // Los tres grandes siguen en la misma escala: 1 1/8 es 18/16. Dejarlos
    // fuera del alambre no era solo perder tres filas — suman al peso de la
    // muestra, que el servidor deriva de lo que recibe, así que el reporte
    // habría dado un peso distinto al de la tablet.
    it("los calibres grandes viajan en la misma escala", () => {
      const calibres = Array.from({ length: CRIBA_MAX_CALIBRES }, () => ({
        total: "",
        average: "",
      }));

      const wire = toRespuestaWirePayload("criba", { calibres }) as {
        calibres: { calibre: number }[];
      };

      expect(
        wire.calibres.slice(CRIBA_CALIBRES.length).map((c) => c.calibre),
      ).toEqual([18, 20, 24]);
    });

    // La regla que recorre todo el formulario: un calibre pesado sin fruta vale
    // cero y uno sin capturar no vale nada. Coalescer el segundo a cero
    // corrompería el reparto de la muestra en el reporte.
    it("0 g sobrevive como 0 y lo vacío como null", () => {
      const calibres = [
        { total: "0", average: "" },
        { total: "350.5", average: "6.2" },
        ...Array.from({ length: CRIBA_CALIBRES.length - 2 }, () => ({
          total: "",
          average: "",
        })),
      ];

      const wire = toRespuestaWirePayload("criba", { calibres }) as {
        calibres: { peso_total: number | null; peso_promedio: number | null }[];
      };

      expect(wire.calibres[0]).toMatchObject({
        peso_total: 0,
        peso_promedio: null,
      });
      expect(wire.calibres[1]).toMatchObject({
        peso_total: 350.5,
        peso_promedio: 6.2,
      });
      expect(wire.calibres[2]).toMatchObject({
        peso_total: null,
        peso_promedio: null,
      });
    });
  });

  describe("rendimiento", () => {
    it("numera los cortes y manda la fecha vacía como null", () => {
      const wire = toRespuestaWirePayload("rendimiento", {
        cortes: [
          { fecha: "2026-08-12", kilogramos: "120.5", racimos: "240" },
          { fecha: "", kilogramos: "", racimos: "" },
        ],
      });

      expect(wire).toEqual({
        cortes: [
          { numero: 1, fecha: "2026-08-12", kilogramos: 120.5, racimos: 240 },
          { numero: 2, fecha: null, kilogramos: null, racimos: null },
        ],
      });
    });

    it("un corte sin fruta viaja en ceros, no en nulos", () => {
      const wire = toRespuestaWirePayload("rendimiento", {
        cortes: [{ fecha: "2026-08-12", kilogramos: "0", racimos: "0" }],
      }) as { cortes: { kilogramos: number; racimos: number }[] };

      expect(wire.cortes[0]).toMatchObject({ kilogramos: 0, racimos: 0 });
    });
  });

  describe("comentarios", () => {
    it("las tres notas, tal cual", () => {
      expect(
        toRespuestaWirePayload("comentarios", {
          positivos: "Buena uniformidad de color.",
          negativos: "",
          observaciones: "",
        }),
      ).toEqual({
        positivos: "Buena uniformidad de color.",
        negativos: "",
        observaciones: "",
      });
    });
  });
});
