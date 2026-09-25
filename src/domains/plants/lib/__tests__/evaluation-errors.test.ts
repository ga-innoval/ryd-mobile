import { buildEvaluationDefaults } from "../evaluation-schema";
import { evaluationErrors } from "../evaluation-errors";

const conCriba = (total: string, average: string) => {
  const values = buildEvaluationDefaults();
  values.criba.calibres[0] = { total, average };
  return values;
};

const conRendimiento = (kilogramos: string, racimos: string) => {
  const values = buildEvaluationDefaults();
  values.rendimiento.cortes[0] = { fecha: "2026-08-12", kilogramos, racimos };
  return values;
};

describe("evaluationErrors", () => {
  it("no ve errores en una evaluación en blanco", () => {
    expect(evaluationErrors(buildEvaluationDefaults())).toEqual([]);
  });

  // Una baya no pesa más que todo lo que cayó en su calibre.
  it("señala criba con el promedio mayor que el peso del calibre", () => {
    expect(evaluationErrors(conCriba("5.2", "52"))).toEqual(["criba"]);
  });

  it("no señala criba cuando los pesos cuadran", () => {
    expect(evaluationErrors(conCriba("100", "5.2"))).toEqual([]);
  });

  // La fruta salió de algún sitio.
  it("señala rendimiento con kilogramos y cero racimos", () => {
    expect(evaluationErrors(conRendimiento("120.5", "0"))).toEqual([
      "rendimiento",
    ]);
  });

  it("no señala el corte sin fruta", () => {
    // 0 kg y 0 racimos es un corte que no dio nada, no un dato imposible.
    expect(evaluationErrors(conRendimiento("0", "0"))).toEqual([]);
  });

  it("no señala el corte al que solo le falta capturar los racimos", () => {
    expect(evaluationErrors(conRendimiento("120.5", ""))).toEqual([]);
  });

  it("devuelve las dos secciones cuando las dos fallan", () => {
    const values = conCriba("5.2", "52");
    values.rendimiento.cortes[0] = {
      fecha: "",
      kilogramos: "120.5",
      racimos: "0",
    };

    expect(evaluationErrors(values)).toEqual(["criba", "rendimiento"]);
  });

  // Los otros cuatro avisos siguen siendo avisos: la captura vale igual.
  it("no convierte en error lo que solo está fuera de lo habitual", () => {
    const values = buildEvaluationDefaults();
    // Un calibre de un kilo y una muestra que no pesa 1.5 ni 2.5 kg.
    values.criba.calibres[0] = { total: "1000", average: "5" };
    values.brix.cortes[0].readings[0] = "99";

    expect(evaluationErrors(values)).toEqual([]);
  });
});
