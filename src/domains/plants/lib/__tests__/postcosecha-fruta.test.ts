import {
  buildFrutaDefaults,
  evaluacionAntesDelEmpaque,
  evaluacionFueraDePeriodo,
  fechaEsperada,
  frutaAnswered,
  periodoDias,
} from "../postcosecha-fruta";

describe("periodoDias", () => {
  it("sale del id de la evaluación", () => {
    expect(periodoDias("15caja")).toBe(15);
    expect(periodoDias("15plastico")).toBe(15);
    expect(periodoDias("30caja")).toBe(30);
    expect(periodoDias("30plastico")).toBe(30);
  });

  it("sin dígitos no hay periodo", () => {
    expect(periodoDias("otra")).toBeNull();
  });
});

describe("fechaEsperada", () => {
  it("suma los días del periodo", () => {
    expect(fechaEsperada("2026-09-29", 15)).toBe("2026-10-14");
    expect(fechaEsperada("2026-09-29", 30)).toBe("2026-10-29");
  });

  it("cruza el fin de mes y el fin de año", () => {
    expect(fechaEsperada("2026-01-25", 15)).toBe("2026-02-09");
    expect(fechaEsperada("2026-12-25", 15)).toBe("2027-01-09");
  });

  /**
   * La razón de sumar en hora local y no con `toISOString()`: con una fecha
   * cualquiera del año, una suma en UTC devolvería el día siguiente para quien
   * esté en un huso por detrás. El resultado tiene que ser el mismo día natural
   * que el evaluador ve en el calendario.
   */
  it("no se corre de día", () => {
    expect(fechaEsperada("2026-03-01", 30)).toBe("2026-03-31");
    expect(fechaEsperada("2026-06-15", 15)).toBe("2026-06-30");
  });

  it("sin empaque o sin periodo no sugiere nada", () => {
    expect(fechaEsperada("", 15)).toBe("");
    expect(fechaEsperada("2026-09-29", null)).toBe("");
  });
});

describe("evaluacionAntesDelEmpaque", () => {
  it("marca la evaluación anterior al empaque", () => {
    expect(evaluacionAntesDelEmpaque("2026-09-29", "2026-09-28")).toBe(true);
  });

  it("el mismo día no es error", () => {
    expect(evaluacionAntesDelEmpaque("2026-09-29", "2026-09-29")).toBe(false);
  });

  it("la posterior tampoco", () => {
    expect(evaluacionAntesDelEmpaque("2026-09-29", "2026-10-14")).toBe(false);
  });

  // Con una de las dos sin capturar no hay nada que comparar todavía: es un
  // dato que falta, no uno imposible.
  it("calla mientras falte alguna de las dos", () => {
    expect(evaluacionAntesDelEmpaque("", "2026-09-28")).toBe(false);
    expect(evaluacionAntesDelEmpaque("2026-09-29", "")).toBe(false);
  });
});

describe("evaluacionFueraDePeriodo", () => {
  it("calla cuando la evaluación cae el día esperado", () => {
    expect(evaluacionFueraDePeriodo("2026-09-29", "2026-10-14", 15)).toBe(
      false,
    );
    expect(evaluacionFueraDePeriodo("2026-09-29", "2026-10-29", 30)).toBe(
      false,
    );
  });

  it("avisa si se abrió antes o después de lo que tocaba", () => {
    expect(evaluacionFueraDePeriodo("2026-09-29", "2026-10-13", 15)).toBe(true);
    expect(evaluacionFueraDePeriodo("2026-09-29", "2026-10-16", 15)).toBe(true);
  });

  /**
   * El mismo día, con el otro periodo, es justo el caso que esto existe para
   * cazar: capturar en «30 días» una caja que se abrió a los 15.
   */
  it("avisa si la fecha es la del otro periodo", () => {
    expect(evaluacionFueraDePeriodo("2026-09-29", "2026-10-14", 30)).toBe(true);
    expect(evaluacionFueraDePeriodo("2026-09-29", "2026-10-29", 15)).toBe(true);
  });

  // Un dato que falta no es un dato raro.
  it("calla mientras falte alguna de las dos fechas o el periodo", () => {
    expect(evaluacionFueraDePeriodo("", "2026-10-14", 15)).toBe(false);
    expect(evaluacionFueraDePeriodo("2026-09-29", "", 15)).toBe(false);
    expect(evaluacionFueraDePeriodo("2026-09-29", "2026-10-14", null)).toBe(
      false,
    );
  });

  /**
   * Un aviso a la vez, el más grave: si la evaluación es anterior al empaque ya
   * habla el error, y enseñar los dos sería contar dos veces lo mismo.
   */
  it("se calla cuando el error ya está hablando", () => {
    expect(evaluacionFueraDePeriodo("2026-09-29", "2026-09-28", 15)).toBe(
      false,
    );
  });
});

describe("frutaAnswered", () => {
  it("en blanco no cuenta ninguna", () => {
    expect(frutaAnswered(buildFrutaDefaults())).toBe(0);
  });

  it("contestar una sube el conteo", () => {
    expect(frutaAnswered({ ...buildFrutaDefaults(), acidez: "low" })).toBe(1);
  });

  /**
   * **Un 0 % medido sí cuenta**, y es lo que separa esta pregunta de un campo
   * que nadie tocó: la barra distingue los dos estados y basta un toque para
   * capturar el cero. Está fijado aquí porque es justo lo que se rompe si
   * alguien devuelve el `0` a los defaults.
   */
  it("un cero capturado cuenta como respuesta", () => {
    expect(
      frutaAnswered({ ...buildFrutaDefaults(), bayas_reventadas: 0 }),
    ).toBe(1);
  });

  it("suma los once", () => {
    expect(
      frutaAnswered({
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
      }),
    ).toBe(11);
  });
});
