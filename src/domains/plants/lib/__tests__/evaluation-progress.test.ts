import { buildEvaluationDefaults } from "../evaluation-schema";
import { EVALS_EXTERIOR } from "../evals-exterior";
import { EVALS_INTERIOR } from "../evals-interior";
import { PHOTO_CATEGORIES } from "../photo-categories";
import { createBrixCorte } from "../brix";
import {
  evaluationProgress,
  plantProgress,
  PROGRESS_SECTIONS,
  seccionProgress,
} from "../evaluation-progress";

describe("seccionProgress", () => {
  it("cuenta las preguntas contestadas sobre su catálogo", () => {
    const answers = Object.fromEntries(
      EVALS_EXTERIOR.slice(0, 8).map((q) => [q.id, q.options[0].value]),
    );

    expect(seccionProgress("exterior", answers)).toBeCloseTo(0.5);
  });

  // Deseleccionar deja la clave puesta en `undefined`: contando claves el
  // avance no bajaría nunca.
  it("no cuenta la pregunta deseleccionada", () => {
    const [primera] = EVALS_EXTERIOR;

    expect(seccionProgress("exterior", { [primera.id]: undefined })).toBe(0);
  });

  it("cuenta los calibres completos de criba", () => {
    const { criba } = buildEvaluationDefaults();
    criba.calibres[0] = { total: "100", average: "5" };
    // Pesado en 0 g: se capturó y no tenía fruta, así que cuenta completo.
    criba.calibres[1] = { total: "0", average: "" };

    expect(seccionProgress("criba", criba)).toBeCloseTo(2 / 9);
  });

  it("cuenta las lecturas del primer corte de brix", () => {
    const { brix } = buildEvaluationDefaults();
    brix.cortes[0].readings = ["14.5", "14.2", "", "", "", "", "", "", "", ""];

    expect(seccionProgress("brix", brix)).toBeCloseTo(0.2);
  });

  // Solo se agrega un corte cuando el anterior está terminado, así que el
  // mínimo capturable es uno. Si el denominador creciera, agregar un corte
  // haría retroceder la barra.
  it("no retrocede al agregar un corte de brix", () => {
    const { brix } = buildEvaluationDefaults();
    brix.cortes[0].readings = Array.from({ length: 10 }, () => "14.5");
    const lleno = seccionProgress("brix", brix);

    brix.cortes.push(createBrixCorte());

    expect(seccionProgress("brix", brix)).toBe(lleno);
    expect(lleno).toBe(1);
  });

  it("cuenta los tres datos del primer corte de rendimiento", () => {
    const { rendimiento } = buildEvaluationDefaults();
    rendimiento.cortes[0] = {
      fecha: "2026-09-25",
      kilogramos: "120.5",
      racimos: "",
    };

    expect(seccionProgress("rendimiento", rendimiento)).toBeCloseTo(2 / 3);
  });

  it("cuenta las tomas con alguna fotografía", () => {
    expect(
      seccionProgress("fotografias", { racimo: ["file://1"] }),
    ).toBeCloseTo(1 / 3);
    expect(seccionProgress("fotografias", { racimo: [] })).toBe(0);
  });

  it("no opina de una sección que no reparte avance", () => {
    expect(seccionProgress("comentarios", { positivos: "algo" })).toBe(0);
  });

  it("cuenta como cero lo que no sabe leer", () => {
    expect(seccionProgress("criba", { lo: "que sea" })).toBe(0);
    expect(seccionProgress("brix", null)).toBe(0);
  });
});

describe("evaluationProgress", () => {
  it("arranca en cero", () => {
    expect(evaluationProgress(buildEvaluationDefaults(), {})).toBe(0);
  });

  it("cada sección aporta un sexto", () => {
    const values = buildEvaluationDefaults();
    values.brix.cortes[0].readings = Array.from({ length: 10 }, () => "14.5");

    expect(evaluationProgress(values, {})).toBeCloseTo(1 / 6);
  });

  // Los comentarios no reparten: escribirlos no mueve la barra, y no haberlos
  // escrito no impide llegar al 100 %.
  it("no cuenta los comentarios", () => {
    const values = buildEvaluationDefaults();
    values.comentarios.positivos = "Buena uniformidad.";

    expect(evaluationProgress(values, {})).toBe(0);
    expect(PROGRESS_SECTIONS).not.toContain("comentarios");
  });

  it("llega al 100 % con las seis llenas", () => {
    const values = buildEvaluationDefaults();

    for (const q of EVALS_EXTERIOR) values.exterior[q.id] = q.options[0].value;
    for (const q of EVALS_INTERIOR) values.interior[q.id] = q.options[0].value;
    values.brix.cortes[0].readings = Array.from({ length: 10 }, () => "14.5");
    values.criba.calibres = values.criba.calibres.map(() => ({
      total: "100",
      average: "5",
    }));
    values.rendimiento.cortes[0] = {
      fecha: "2026-09-25",
      kilogramos: "120.5",
      racimos: "240",
    };
    const photos = Object.fromEntries(
      PHOTO_CATEGORIES.map((category) => [category.id, ["file://1"]]),
    );

    expect(evaluationProgress(values, photos)).toBe(1);
  });
});

describe("plantProgress", () => {
  /** Las cuatro evaluaciones de post-cosecha, todas igual. */
  const postcosecha = (valor: number) => [valor, valor, valor, valor];

  it("promedia dentro de cada bloque", () => {
    expect(
      plantProgress([{ progress: 1 }, { progress: 0 }], postcosecha(0)),
    ).toBeCloseTo(0.25);
  });

  /**
   * **La mitad y la mitad**, que es la regla del negocio: toda la post-cosecha
   * capturada vale el 50 % aunque no se haya tocado un solo tratamiento, y al
   * revés.
   */
  it("cada bloque vale la mitad", () => {
    expect(plantProgress([{ progress: 0 }], postcosecha(1))).toBeCloseTo(0.5);
    expect(plantProgress([{ progress: 1 }], postcosecha(0))).toBeCloseTo(0.5);
    expect(plantProgress([{ progress: 1 }], postcosecha(1))).toBe(1);
  });

  // El denominador de post-cosecha es fijo: una evaluación de cuatro es un
  // octavo de la plantación.
  it("una sola evaluación de post-cosecha vale un octavo", () => {
    expect(plantProgress([{ progress: 0 }], [1, 0, 0, 0])).toBeCloseTo(1 / 8);
  });

  /**
   * Sin tratamientos configurados no hay ahí trabajo pendiente, así que
   * post-cosecha se queda con todo: si no, la tarjeta tendría un tope del 50 %
   * que nadie podría subir.
   */
  it("sin tratamientos, post-cosecha se lo lleva todo", () => {
    expect(plantProgress([], postcosecha(1))).toBe(1);
    expect(plantProgress([], postcosecha(0.5))).toBeCloseTo(0.5);
  });

  it("es cero sin nada capturado", () => {
    expect(plantProgress([], [])).toBe(0);
    expect(plantProgress([{ progress: 0 }], postcosecha(0))).toBe(0);
  });

  // De esto vive el estatus de la tarjeta y los filtros: en cuanto una sola
  // encuesta arranca, la plantación deja de estar «sin iniciar».
  it("deja de ser cero en cuanto algo arranca", () => {
    expect(
      plantProgress([{ progress: 0 }, { progress: 0.1 }], postcosecha(0)),
    ).toBeGreaterThan(0);
    expect(plantProgress([{ progress: 0 }], [0, 0.1, 0, 0])).toBeGreaterThan(0);
  });
});
