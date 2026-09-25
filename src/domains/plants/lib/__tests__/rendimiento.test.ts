import {
  createRendimientoCorte,
  formatAveragePerRacimo,
  formatKilos,
  sanitizeKilogramos,
  sanitizeRacimos,
  summarizeRendimiento,
} from "../rendimiento";
import type { RendimientoCorte } from "../../types";

/** Un corte con los datos dados; lo que no se pase va vacío. */
const corte = (
  fecha = "",
  kilogramos = "",
  racimos = "",
): RendimientoCorte => ({ fecha, kilogramos, racimos });

const COMPLETO = corte("2026-08-12", "412.5", "318");

describe("summarizeRendimiento", () => {
  it("suma los kilogramos capturados", () => {
    const { total, registeredCount } = summarizeRendimiento([
      COMPLETO,
      corte("2026-08-26", "386", "295"),
    ]);

    expect(total).toBeCloseTo(798.5);
    expect(registeredCount).toBe(2);
  });

  // Vacío no es cero: un corte sin kilogramos no suma ni cuenta.
  it("deja vacío el total sin ningún kilogramo", () => {
    const { total, registeredCount } = summarizeRendimiento([
      createRendimientoCorte(),
    ]);

    expect(total).toBeNull();
    expect(registeredCount).toBe(0);
  });

  it("cuenta el corte pesado en cero, que sí se pesó", () => {
    const { total, registeredCount } = summarizeRendimiento([
      corte("2026-08-12", "0", "0"),
    ]);

    expect(total).toBe(0);
    expect(registeredCount).toBe(1);
  });

  it("promedia los kilogramos entre los racimos", () => {
    const { cortes } = summarizeRendimiento([COMPLETO]);

    expect(cortes[0].average).toBeCloseTo(412.5 / 318);
  });

  it("deja vacío el promedio mientras falte un dato", () => {
    const { cortes } = summarizeRendimiento([corte("2026-08-12", "412.5")]);

    expect(cortes[0].average).toBeNull();
  });

  // Con 0 kg y 0 racimos no hay nada que promediar, y un cero parecería un dato.
  it("marca el corte sin fruta en vez de promediar", () => {
    const { cortes } = summarizeRendimiento([corte("2026-08-12", "0", "0")]);

    expect(cortes[0].noFruit).toBe(true);
    expect(cortes[0].average).toBeNull();
    expect(cortes[0].zeroRacimos).toBe(false);
  });

  // Imposible: la fruta salió de algún sitio.
  it("marca error en los kilogramos con el conteo en cero", () => {
    const { cortes } = summarizeRendimiento([
      corte("2026-08-12", "412.5", "0"),
    ]);

    expect(cortes[0].zeroRacimos).toBe(true);
    expect(cortes[0].average).toBeNull();
  });

  // Falta el conteo, no está mal: de los datos que faltan habla el avance de la
  // sección, no una alerta.
  it("no marca el corte con el conteo todavía sin capturar", () => {
    const { cortes } = summarizeRendimiento([corte("2026-08-12", "412.5", "")]);

    expect(cortes[0].zeroRacimos).toBe(false);
  });

  it("no marca el corte que se está tecleando", () => {
    const { cortes } = summarizeRendimiento(
      [corte("2026-08-12", "412.5", "0")],
      0,
    );

    expect(cortes[0].zeroRacimos).toBe(false);
  });

  it("deja agregar otro corte cuando el último está terminado", () => {
    expect(summarizeRendimiento([COMPLETO]).canAdd).toBe(true);
  });

  it("no deja agregar con el último corte a medias", () => {
    expect(summarizeRendimiento([corte("2026-08-12", "412.5")]).canAdd).toBe(
      false,
    );
    expect(summarizeRendimiento([corte("", "412.5", "318")]).canAdd).toBe(
      false,
    );
  });

  // Sin tope por arriba, por ahora: lo único que impide acumular renglones es
  // que el siguiente no se habilita hasta terminar el anterior.
  it("deja agregar aunque ya haya cinco cortes", () => {
    const { canAdd } = summarizeRendimiento(
      Array.from({ length: 5 }, () => COMPLETO),
    );

    expect(canAdd).toBe(true);
  });

  it("no deja descartar el único corte", () => {
    expect(summarizeRendimiento([COMPLETO]).canRemove).toBe(false);
  });

  it("deja descartar cuando hay más de uno", () => {
    expect(
      summarizeRendimiento([COMPLETO, createRendimientoCorte()]).canRemove,
    ).toBe(true);
  });
});

describe("formatKilos", () => {
  it("muestra un guion sin valor", () => {
    expect(formatKilos(null)).toBe("—");
  });

  it("muestra un decimal y separa los miles", () => {
    expect(formatKilos(1180)).toBe("1,180.0");
  });
});

describe("formatAveragePerRacimo", () => {
  it("muestra un guion sin valor", () => {
    expect(formatAveragePerRacimo(null)).toBe("—");
  });

  it("muestra dos decimales", () => {
    expect(formatAveragePerRacimo(412.5 / 318)).toBe("1.30");
  });
});

describe("sanitizeKilogramos", () => {
  it("convierte la coma en punto", () => {
    expect(sanitizeKilogramos("412,5")).toBe("412.5");
  });
});

describe("sanitizeRacimos", () => {
  // Se cuentan de uno en uno: el separador no llega ni a escribirse.
  it("descarta todo lo que no sea dígito", () => {
    expect(sanitizeRacimos("3.18")).toBe("318");
    expect(sanitizeRacimos("31a8")).toBe("318");
  });
});
