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

/** Los doce campos contestados, para el extremo de arriba. */
const frutaLlena = {
  fecha_empaque: "2026-09-29",
  fecha_evaluacion: "2026-10-14",
  acidez: "medium",
  tallo: 4,
  peso_inicial: "8200",
  peso_final: "8002",
  peso_bayas_reventadas: "280",
  peso_desgrane: "160",
  dano_azufre: "zero",
  manchas_cafes: "low",
  calidad_consumo: 4,
  sabor: 5,
};

describe("postcosechaSeccionProgress", () => {
  it("mide el relleno de fruta", () => {
    expect(postcosechaSeccionProgress("fruta", buildFrutaDefaults())).toBe(0);
    expect(postcosechaSeccionProgress("fruta", frutaLlena)).toBe(1);
    expect(
      postcosechaSeccionProgress("fruta", {
        ...buildFrutaDefaults(),
        acidez: "low",
      }),
    ).toBeCloseTo(1 / 12);
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
  it("reparte entre doce campos y una toma", () => {
    expect(POSTCOSECHA_TOTAL_UNIDADES).toBe(13);
  });

  /**
   * **En blanco abre en cero**, y es lo que este test defiende: mientras los
   * tres porcentajes no tuvieron estado vacío, una evaluación recién abierta ya
   * enseñaba un 25 % de avance que nadie había capturado.
   */
  it("en blanco no cuenta nada", () => {
    expect(postcosechaProgress(buildPostcosechaDefaults(), 0)).toBe(0);
  });

  it("la fotografía vale una unidad, como cada pregunta", () => {
    const vacia = buildPostcosechaDefaults();

    expect(
      postcosechaProgress(vacia, 1) - postcosechaProgress(vacia, 0),
    ).toBeCloseTo(1 / 13);
  });

  it("llega al 100 % con los doce y la toma", () => {
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
   * entero —`round(contestadas / 12 × 100)`— y el listado tiene que recuperar
   * el conteo a partir de él, porque no puede abrir payloads. Con doce campos
   * los trece valores no se pisan y la vuelta es exacta; con otro número podría
   * dejar de serlo sin que nada avise, y por eso se recorren todos.
   */
  it("recupera el conteo exacto de la columna, para todos", () => {
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
    expect(postcosechaProgressFromRow(0, 1)).toBeCloseTo(1 / 13);
  });
});
