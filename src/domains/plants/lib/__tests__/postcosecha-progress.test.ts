import { buildPostcosechaDefaults } from "../postcosecha-schema";
import {
  postcosechaProgress,
  postcosechaProgressFromRow,
  postcosechaSeccionProgress,
  POSTCOSECHA_TOTAL_UNIDADES,
} from "../postcosecha-progress";
import { formatProgress } from "../evaluation-progress";
import {
  buildFrutaDefaults,
  FRUTA_TOTAL_PREGUNTAS,
} from "../postcosecha-fruta";

/** Las once contestadas, para el extremo de arriba. */
const frutaLlena = {
  fecha_empaque: "2026-09-29",
  fecha_evaluacion: "2026-10-14",
  acidez: "medium",
  tallo: 4,
  bayas_reventadas: 3.5,
  desgrane: 6,
  dano_azufre: "zero",
  manchas_cafes: "low",
  calidad_consumo: 4,
  sabor: 5,
  deshidratacion: 22,
};

describe("postcosechaSeccionProgress", () => {
  // Tres de once en blanco, no cero: los porcentajes no tienen estado vacío.
  it("mide el relleno de fruta", () => {
    expect(
      postcosechaSeccionProgress("fruta", buildFrutaDefaults()),
    ).toBeCloseTo(3 / 11);
    expect(postcosechaSeccionProgress("fruta", frutaLlena)).toBe(1);
  });

  it("las notas no reparten", () => {
    expect(
      postcosechaSeccionProgress("comentarios", { positivos: "algo" }),
    ).toBe(0);
  });

  // Se le pregunta también por lo que sale de SQLite, que es texto hasta que
  // alguien lo valida: lo que no encaje cuenta como cero, no como error.
  it("lo que no sabe leer cuenta cero", () => {
    expect(postcosechaSeccionProgress("fruta", undefined)).toBe(0);
    expect(postcosechaSeccionProgress("fruta", "vaya")).toBe(0);
    expect(postcosechaSeccionProgress("otra", frutaLlena)).toBe(0);
  });
});

describe("postcosechaProgress", () => {
  it("reparte entre once preguntas y una toma", () => {
    expect(POSTCOSECHA_TOTAL_UNIDADES).toBe(12);
  });

  /**
   * **En blanco abre en 3 de 12, no en cero.** Está fijado aquí para que quien
   * vea un 25 % en una evaluación recién abierta encuentre el porqué en vez de
   * tratarlo como un fallo: los tres porcentajes arrancan en 0 y desde el primer
   * frame llevan dato. Lo que no pasa es que eso ensucie el listado — sin tocar
   * nada no se escribe ninguna fila, y sin fila el avance guardado es cero.
   */
  it("en blanco ya cuenta los tres porcentajes", () => {
    expect(postcosechaProgress(buildPostcosechaDefaults(), 0)).toBeCloseTo(
      3 / 12,
    );
  });

  it("la fotografía vale una unidad, como cada pregunta", () => {
    const vacia = buildPostcosechaDefaults();

    expect(
      postcosechaProgress(vacia, 1) - postcosechaProgress(vacia, 0),
    ).toBeCloseTo(1 / 12);
  });

  it("llega al 100 % con las once y la toma", () => {
    expect(
      postcosechaProgress(
        { ...buildPostcosechaDefaults(), fruta: frutaLlena },
        1,
      ),
    ).toBe(1);
  });

  // Las notas quedan fuera del reparto: escribirlas no mueve la barra.
  it("no cuenta las notas", () => {
    const conNotas = buildPostcosechaDefaults();
    conNotas.comentarios.positivos = "Buena uniformidad.";

    expect(postcosechaProgress(conNotas, 0)).toBeCloseTo(
      postcosechaProgress(buildPostcosechaDefaults(), 0),
    );
  });

  // Una categoría retirada del catálogo podría dejar un conteo mayor que las
  // tomas que existen; la barra no puede pasar del 100 %.
  it("no se pasa del tope aunque lleguen tomas de más", () => {
    expect(
      postcosechaProgress(
        { ...buildPostcosechaDefaults(), fruta: frutaLlena },
        9,
      ),
    ).toBe(1);
  });
});

describe("postcosechaProgressFromRow", () => {
  /**
   * **La propiedad de la que vive la barra de la tarjeta.** La columna guarda un
   * entero —`round(contestadas / 11 × 100)`— y el listado tiene que recuperar
   * el conteo a partir de él, porque no puede abrir payloads. Con once preguntas
   * los doce valores no se pisan y la vuelta es exacta; con otro número podría
   * dejar de serlo sin que nada avise, y por eso se recorren los doce.
   */
  it("recupera el conteo exacto de la columna, para las doce", () => {
    for (
      let contestadas = 0;
      contestadas <= FRUTA_TOTAL_PREGUNTAS;
      contestadas++
    ) {
      const columna = formatProgress(contestadas / FRUTA_TOTAL_PREGUNTAS);

      expect(postcosechaProgressFromRow(columna, 0)).toBeCloseTo(
        contestadas / POSTCOSECHA_TOTAL_UNIDADES,
      );
    }
  });

  // Los dos caminos —la pantalla sobre los valores vivos, el listado sobre la
  // columna— tienen que dar el mismo número sobre el mismo dato.
  it("coincide con lo que calcula la pantalla", () => {
    const values = { ...buildPostcosechaDefaults(), fruta: frutaLlena };
    const columna = formatProgress(
      postcosechaSeccionProgress("fruta", frutaLlena),
    );

    expect(postcosechaProgressFromRow(columna, 1)).toBeCloseTo(
      postcosechaProgress(values, 1),
    );
  });

  it("sin fila y sin fotografías es cero", () => {
    expect(postcosechaProgressFromRow(0, 0)).toBe(0);
  });

  // Una evaluación que solo tiene fotografía no tiene fila en `postcosecha_respuestas`.
  it("la fotografía sola ya suma", () => {
    expect(postcosechaProgressFromRow(0, 1)).toBeCloseTo(1 / 12);
  });
});
