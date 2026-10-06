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

  /**
   * Los dos avisos que siguen siendo avisos, porque no dependen de un número
   * que el negocio haya fijado: una muestra que no pesa ni 1.5 ni 2.5 kg, y un
   * promedio por baya menor que el del calibre anterior.
   */
  it("no convierte en error lo que solo está fuera de lo habitual", () => {
    const values = buildEvaluationDefaults();
    // Entre los dos no llegan a 1.5 kg, y el segundo promedio baja.
    values.criba.calibres[0] = { total: "500", average: "5" };
    values.criba.calibres[1] = { total: "400", average: "4" };

    expect(evaluationErrors(values)).toEqual([]);
  });

  // Los rangos que fijó el negocio: fuera de ellos ya no se avisa, se bloquea.
  it("marca Brix fuera de su rango", () => {
    const values = buildEvaluationDefaults();
    values.brix.cortes[0].readings[0] = "31";

    expect(evaluationErrors(values)).toEqual(["brix"]);
  });

  it("marca el calibre que pasa de cuatro kilos y el promedio imposible", () => {
    const values = buildEvaluationDefaults();
    values.criba.calibres[0] = { total: "4500", average: "5" };

    expect(evaluationErrors(values)).toEqual(["criba"]);

    values.criba.calibres[0] = { total: "900", average: "0.4" };

    expect(evaluationErrors(values)).toEqual(["criba"]);
  });

  it("marca el corte fuera de los rangos de rendimiento", () => {
    const values = buildEvaluationDefaults();
    values.rendimiento.cortes[0] = {
      fecha: "2026-09-29",
      kilogramos: "600",
      racimos: "300",
    };

    expect(evaluationErrors(values)).toEqual(["rendimiento"]);
  });

  /**
   * **Un corte sin fruta sigue siendo válido**: 0 kg con 0 racimos es un corte
   * que se cosechó y no dio nada, y tiene que poder registrarse. Es la
   * excepción a los dos rangos, y lo que este test defiende.
   */
  it("no marca el corte que no dio fruta", () => {
    const values = buildEvaluationDefaults();
    values.rendimiento.cortes[0] = {
      fecha: "2026-09-29",
      kilogramos: "0",
      racimos: "0",
    };

    expect(evaluationErrors(values)).toEqual([]);
  });
});
