import {
  buildFrutaDefaults,
  frutaPesosHasError,
  summarizeFrutaPesos,
  evaluacionAntesDelEmpaque,
  evaluacionFueraDePeriodo,
  fechaEsperada,
  frutaAnswered,
  periodoDias,
} from "../postcosecha-fruta";

/** Los doce campos contestados, con pesos que cuadran. */
const FRUTA_LLENA = {
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

  // Un peso de 0 g es un dato —la caja se pesó y no había nada—, al revés que
  // un campo en blanco.
  it("un peso de cero cuenta como respuesta", () => {
    expect(frutaAnswered({ ...buildFrutaDefaults(), peso_desgrane: "0" })).toBe(
      1,
    );
  });

  it("suma los doce", () => {
    expect(frutaAnswered(FRUTA_LLENA)).toBe(12);
  });
});

describe("summarizeFrutaPesos", () => {
  const pesos = (overrides: Partial<typeof FRUTA_LLENA> = {}) =>
    summarizeFrutaPesos({ ...FRUTA_LLENA, ...overrides });

  it("calcula los tres desde los cuatro pesos", () => {
    const { deshidratacion, bayasReventadas, desgrane } = pesos();

    // 8200 → 8002: 198 g menos, un 2.41 %.
    expect(deshidratacion.value).toBeCloseTo(((8200 - 8002) / 8200) * 100);
    expect(deshidratacion.caption).toBe("198.0 g menos que al entrar");
    expect(bayasReventadas.value).toBeCloseTo((280 / 8002) * 100);
    expect(desgrane.value).toBeCloseTo((160 / 8002) * 100);
  });

  // Un dato que falta no es un dato imposible: no hay resultado, pero tampoco
  // error, y la leyenda dice cuál de los cuatro falta.
  it("dice qué falta en vez de calcular a medias", () => {
    expect(pesos({ peso_final: "" }).deshidratacion).toEqual({
      value: null,
      caption: "Falta el peso final",
    });
    expect(pesos({ peso_inicial: "" }).deshidratacion.caption).toBe(
      "Falta el peso inicial",
    );
    expect(pesos({ peso_bayas_reventadas: "" }).bayasReventadas.caption).toBe(
      "Falta el peso de las bayas",
    );
    expect(pesos({ peso_desgrane: "" }).desgrane.caption).toBe(
      "Falta el peso de desgrane",
    );
  });

  describe("los tres pesos imposibles", () => {
    // La fruta no sale del cuarto frío pesando más de lo que entró.
    it("el final no puede pasar del inicial", () => {
      const { errors, deshidratacion } = pesos({ peso_final: "8400" });

      expect(errors.peso_final).toBe(true);
      expect(deshidratacion).toEqual({
        value: null,
        caption: "Revisa el peso final",
      });
    });

    // Ninguna parte de la caja pesa más que la caja entera.
    it("ni las partes pasar del final", () => {
      expect(
        pesos({ peso_bayas_reventadas: "9000" }).errors.peso_bayas_reventadas,
      ).toBe(true);
      expect(pesos({ peso_desgrane: "9000" }).errors.peso_desgrane).toBe(true);
    });

    /**
     * **Con un peso imposible no se calcula**: un porcentaje salido de un dato
     * que no puede ser cierto parece un resultado y no lo es.
     */
    it("no calculan nada con un peso imposible", () => {
      expect(pesos({ peso_bayas_reventadas: "9000" }).bayasReventadas).toEqual({
        value: null,
        caption: "Revisa el peso",
      });
    });

    it("el mismo peso no es imposible", () => {
      expect(pesos({ peso_final: "8200" }).errors.peso_final).toBe(false);
    });
  });

  // Dividir entre cero no da un resultado, da una leyenda.
  it("no divide entre cero", () => {
    expect(
      pesos({ peso_inicial: "0", peso_final: "0" }).deshidratacion,
    ).toEqual({ value: null, caption: "El peso inicial es cero" });
    expect(
      pesos({ peso_final: "0", peso_bayas_reventadas: "0" }).bayasReventadas
        .caption,
    ).toBe("El peso final es cero");
  });
});

describe("frutaPesosHasError", () => {
  it("con los cuatro pesos cuadrando, ninguno", () => {
    expect(frutaPesosHasError(FRUTA_LLENA)).toBe(false);
    expect(frutaPesosHasError(buildFrutaDefaults())).toBe(false);
  });

  it("basta uno para marcar la sección", () => {
    expect(frutaPesosHasError({ ...FRUTA_LLENA, peso_desgrane: "9000" })).toBe(
      true,
    );
  });
});
