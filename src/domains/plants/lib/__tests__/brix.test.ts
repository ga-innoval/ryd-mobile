import {
  BRIX_READINGS_PER_CORTE,
  canAddBrixCorte,
  canRemoveBrixCorte,
  createBrixCorte,
  formatBrix,
  parseBrixReading,
  removeLastBrixCorte,
  sanitizeBrixInput,
  setBrixReading,
  summarizeBrix,
  summarizeBrixCorte,
} from "../brix";
import type { BrixCorte } from "../../types";

/** Un corte con las lecturas dadas en orden y el resto vacías. */
const corte = (...readings: string[]): BrixCorte => ({
  readings: Array.from(
    { length: BRIX_READINGS_PER_CORTE },
    (_, index) => readings[index] ?? "",
  ),
});

// Diez lecturas que dan R1–R5 = 17.95, 18.05, 17.75, 18.15, 17.90.
const COMPLETO = corte(
  "17.8",
  "18.1",
  "18.2",
  "17.9",
  "17.6",
  "17.9",
  "18.3",
  "18.0",
  "17.7",
  "18.1",
);

describe("sanitizeBrixInput", () => {
  it("convierte la coma en punto", () => {
    expect(sanitizeBrixInput("18,4")).toBe("18.4");
  });

  it("descarta lo que no sea dígito o separador", () => {
    expect(sanitizeBrixInput("1a8 .4°")).toBe("18.4");
  });

  it("deja un solo separador decimal", () => {
    expect(sanitizeBrixInput("18.4.5")).toBe("18.45");
  });

  it("recorta lo que ya no puede ser una lectura", () => {
    expect(sanitizeBrixInput("18.25999")).toBe("18.259");
  });
});

describe("parseBrixReading", () => {
  it("devuelve null si está vacía", () => {
    expect(parseBrixReading("")).toBeNull();
  });

  it("devuelve null con solo el separador", () => {
    expect(parseBrixReading(".")).toBeNull();
  });

  it("lee un número a medio escribir", () => {
    expect(parseBrixReading("18.")).toBe(18);
  });
});

describe("summarizeBrixCorte", () => {
  it("promedia cada par de lecturas consecutivas", () => {
    const { pairs } = summarizeBrixCorte(COMPLETO.readings);

    expect(pairs.map((pair) => pair.value)).toEqual([
      expect.closeTo(17.95),
      expect.closeTo(18.05),
      expect.closeTo(17.75),
      expect.closeTo(18.15),
      expect.closeTo(17.9),
    ]);
  });

  // Tomarla como cero hundiría el promedio sin que nadie lo notara.
  it("deja vacío el resultado al que le falta una lectura", () => {
    const { pairs } = summarizeBrixCorte(corte("19.7").readings);

    expect(pairs[0].value).toBeNull();
  });

  it("promedia solo los resultados que existen", () => {
    // R1 = 19.25, R2 = 19.70, R3 = 19.35; R4 y R5 vacíos.
    const { average } = summarizeBrixCorte(
      corte("19.4", "19.1", "19.6", "19.8", "19.2", "19.5", "19.7").readings,
    );

    expect(average).toBeCloseTo(58.3 / 3, 10);
  });

  it("no redondea el promedio", () => {
    const { average } = summarizeBrixCorte(
      corte("19.4", "19.1", "19.6", "19.8", "19.2", "19.5").readings,
    );

    expect(average).not.toBe(19.43);
    expect(average).toBeCloseTo(19.4333333, 6);
  });

  it("devuelve promedio null sin resultados", () => {
    expect(summarizeBrixCorte(corte("18.2").readings).average).toBeNull();
  });

  it("cuenta las lecturas capturadas", () => {
    const summary = summarizeBrixCorte(corte("18.2", "", "18.4").readings);

    expect(summary.filled).toBe(2);
    expect(summary.complete).toBe(false);
  });

  it("marca el corte completo con las diez lecturas", () => {
    expect(summarizeBrixCorte(COMPLETO.readings).complete).toBe(true);
  });

  // Puede ser una lectura real: se avisa, pero no se descarta.
  it("marca la lectura fuera de rango y la sigue contando", () => {
    const summary = summarizeBrixCorte(corte("18.1", "184").readings);

    expect(summary.pairs[0]).toEqual({
      value: expect.closeTo(101.05),
      outOfRange: true,
    });
    expect(summary.outOfRange.slice(0, 2)).toEqual([false, true]);
    expect(summary.firstOutOfRange).toBe(1);
  });

  it("no marca nada con lecturas en rango", () => {
    expect(summarizeBrixCorte(COMPLETO.readings).firstOutOfRange).toBeNull();
  });
});

describe("summarizeBrix", () => {
  // Corte 1 completo con R = 18 en todos; corte 2 solo con R1 = 20. Promediar
  // los promedios daría (18 + 20) / 2 = 19 y pesaría igual un corte a medias.
  it("promedia todos los R, no los promedios de cada corte", () => {
    const { average } = summarizeBrix([
      corte(...Array.from({ length: 10 }, () => "18")),
      corte("20", "20"),
    ]);

    expect(average).toBeCloseTo((18 * 5 + 20) / 6, 10);
  });

  it("cuenta solo los cortes con alguna lectura", () => {
    const { capturedCount } = summarizeBrix([COMPLETO, createBrixCorte()]);

    expect(capturedCount).toBe(1);
  });

  it("devuelve promedio null sin lecturas", () => {
    expect(summarizeBrix([createBrixCorte()]).average).toBeNull();
  });
});

describe("canAddBrixCorte", () => {
  it("no deja agregar si el último corte está vacío", () => {
    expect(canAddBrixCorte([createBrixCorte()])).toBe(false);
  });

  it("deja agregar en cuanto el último tiene una lectura", () => {
    expect(canAddBrixCorte([corte("18.2")])).toBe(true);
  });

  it("mira solo el último corte", () => {
    expect(canAddBrixCorte([COMPLETO, createBrixCorte()])).toBe(false);
  });

  it("no cuenta como lectura un separador suelto", () => {
    expect(canAddBrixCorte([corte(".")])).toBe(false);
  });
});

describe("canRemoveBrixCorte", () => {
  it("no deja descartar el único corte", () => {
    expect(canRemoveBrixCorte([COMPLETO])).toBe(false);
  });

  it("deja descartar cuando hay más de uno", () => {
    expect(canRemoveBrixCorte([COMPLETO, createBrixCorte()])).toBe(true);
  });
});

describe("removeLastBrixCorte", () => {
  it("quita solo el último", () => {
    const segundo = corte("20");

    expect(removeLastBrixCorte([COMPLETO, segundo, createBrixCorte()])).toEqual(
      [COMPLETO, segundo],
    );
  });

  it("conserva el único corte", () => {
    const cortes = [COMPLETO];

    expect(removeLastBrixCorte(cortes)).toBe(cortes);
  });

  it("no muta el array recibido", () => {
    const cortes = [COMPLETO, createBrixCorte()];

    removeLastBrixCorte(cortes);
    expect(cortes).toHaveLength(2);
  });
});

describe("setBrixReading", () => {
  it("cambia solo la lectura indicada", () => {
    const [primero, segundo] = setBrixReading(
      [corte("18.2"), corte("19.0")],
      1,
      1,
      "19.4",
    );

    expect(primero.readings.slice(0, 2)).toEqual(["18.2", ""]);
    expect(segundo.readings.slice(0, 2)).toEqual(["19.0", "19.4"]);
  });

  it("no muta los cortes recibidos", () => {
    const cortes = [corte("18.2")];

    setBrixReading(cortes, 0, 0, "20");
    expect(cortes[0].readings[0]).toBe("18.2");
  });
});

describe("formatBrix", () => {
  it("muestra un guion sin valor", () => {
    expect(formatBrix(null)).toBe("—");
  });

  it("muestra siempre dos decimales", () => {
    expect(formatBrix(18.4)).toBe("18.40");
  });

  it("redondea solo al mostrar", () => {
    expect(formatBrix(58.3 / 3)).toBe("19.43");
  });

  // En binario 59.725 queda en 59.72499…, y `toFixed` a secas daría "59.72".
  it("redondea la mitad hacia arriba, como la cuenta a mano", () => {
    expect(formatBrix((18.4 + 101.05) / 2)).toBe("59.73");
  });
});
