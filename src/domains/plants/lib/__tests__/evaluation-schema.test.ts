import {
  buildEvaluationDefaults,
  buildQuestionsSchema,
  evaluationSchema,
} from "../evaluation-schema";
import { BRIX_READINGS_PER_CORTE, isBrixOutOfRange } from "../brix";
import { CRIBA_CALIBRES } from "../criba";
import { EVALS_EXTERIOR } from "../evals-exterior";
import type { EvalQuestion } from "../../types";

const PREGUNTA: EvalQuestion = {
  id: "forma",
  label: "Forma",
  options: [
    { label: "Round", value: "round" },
    { label: "Ovoid", value: "ovoid" },
  ],
};

/** Un corte con las lecturas dadas en orden y el resto vacías. */
const corte = (...readings: string[]) => ({
  readings: Array.from(
    { length: BRIX_READINGS_PER_CORTE },
    (_, index) => readings[index] ?? "",
  ),
});

/** Los nueve calibres con los pesos dados en orden y el resto sin pesar. */
const calibres = (...pesos: [string, string][]) =>
  CRIBA_CALIBRES.map((_, index) => ({
    total: pesos[index]?.[0] ?? "",
    average: pesos[index]?.[1] ?? "",
  }));

/** Una evaluación en blanco salvo por los cortes de Brix dados. */
const conCortes = (...cortes: { readings: string[] }[]) => ({
  ...buildEvaluationDefaults(),
  brix: { cortes },
});

/** Una evaluación en blanco salvo por los calibres de criba dados. */
const conCalibres = (...pesos: [string, string][]) => ({
  ...buildEvaluationDefaults(),
  criba: { calibres: calibres(...pesos) },
});

describe("buildQuestionsSchema", () => {
  const schema = buildQuestionsSchema([PREGUNTA]);

  it("acepta una opción del catálogo", () => {
    expect(schema.safeParse({ forma: "ovoid" }).success).toBe(true);
  });

  it("rechaza un valor que no está en el catálogo", () => {
    expect(schema.safeParse({ forma: "square" }).success).toBe(false);
  });

  it("deja las preguntas sin contestar, también al deseleccionar", () => {
    expect(schema.safeParse({}).success).toBe(true);
    // Deseleccionar una opción deja la clave puesta con `undefined`.
    expect(schema.safeParse({ forma: undefined }).success).toBe(true);
  });
});

describe("buildEvaluationDefaults", () => {
  it("arranca sin respuestas, con un corte vacío y sin pesar", () => {
    expect(buildEvaluationDefaults()).toEqual({
      exterior: {},
      interior: {},
      brix: { cortes: [corte()] },
      criba: { calibres: calibres() },
      rendimiento: { cortes: [{ fecha: "", kilogramos: "", racimos: "" }] },
      comentarios: { positivos: "", negativos: "", observaciones: "" },
    });
  });

  it("es una evaluación válida", () => {
    expect(evaluationSchema.safeParse(buildEvaluationDefaults()).success).toBe(
      true,
    );
  });

  it("devuelve objetos nuevos en cada llamada", () => {
    const primero = buildEvaluationDefaults();
    const segundo = buildEvaluationDefaults();

    expect(primero.brix.cortes).not.toBe(segundo.brix.cortes);
    expect(primero.brix.cortes[0].readings).not.toBe(
      segundo.brix.cortes[0].readings,
    );
  });
});

describe("evaluationSchema", () => {
  it("valida cada sección contra su propio catálogo", () => {
    const valores = {
      ...buildEvaluationDefaults(),
      exterior: { [EVALS_EXTERIOR[0].id]: "no-existe" },
    };

    expect(evaluationSchema.safeParse(valores).success).toBe(false);
  });

  it("devuelve las lecturas de Brix como números", () => {
    const resultado = evaluationSchema.parse(
      conCortes(corte("18.4", "", ".", "18.")),
    );

    expect(resultado.brix.cortes[0].readings.slice(0, 4)).toEqual([
      18.4,
      null,
      null,
      18,
    ]);
  });

  it("no bloquea una lectura fuera de rango: se avisa, pero cuenta", () => {
    // El punto decimal olvidado: 184 en vez de 18.4. Es justo lo que marca el
    // esquema de rango, y justo por eso no debe impedir guardar — podría ser
    // real, y descartarla en silencio sería peor.
    const resultado = evaluationSchema.safeParse(conCortes(corte("184")));

    expect(resultado.success).toBe(true);
    expect(isBrixOutOfRange(184)).toBe(true);
  });

  it("exige las diez lecturas de cada corte", () => {
    expect(
      evaluationSchema.safeParse(conCortes({ readings: ["18.4"] })).success,
    ).toBe(false);
  });

  it("no admite una evaluación sin cortes", () => {
    expect(evaluationSchema.safeParse(conCortes()).success).toBe(false);
  });

  it("devuelve los pesos de la criba como números", () => {
    const resultado = evaluationSchema.parse(conCalibres(["1483.5", ""]));

    // Un calibre sin promedio no es un cero: el peso que falta queda en `null`.
    expect(resultado.criba.calibres[0]).toEqual({
      total: 1483.5,
      average: null,
    });
  });

  it("exige los nueve calibres", () => {
    // Es la posición la que dice de qué calibre es cada peso, así que una tabla
    // más corta no se puede leer.
    expect(
      evaluationSchema.safeParse({
        ...buildEvaluationDefaults(),
        criba: { calibres: [{ total: "1483.5", average: "8.18" }] },
      }).success,
    ).toBe(false);
  });
});
