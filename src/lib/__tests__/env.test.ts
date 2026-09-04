import { toPositiveNumber } from "../env";

const FALLBACK = 7_200_000;

describe("toPositiveNumber", () => {
  it("usa el valor cuando es un número válido", () => {
    expect(toPositiveNumber("10000", FALLBACK)).toBe(10_000);
  });

  it("cae al fallback cuando la variable no está definida", () => {
    expect(toPositiveNumber(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it("cae al fallback cuando el valor no es numérico", () => {
    // El caso peligroso: `Number("2h")` es NaN, y con NaN el guard de tiempo
    // del sondeo falla abierto y `setTimeout` dispara de inmediato.
    expect(toPositiveNumber("2h", FALLBACK)).toBe(FALLBACK);
  });

  it("cae al fallback con cadena vacía", () => {
    expect(toPositiveNumber("", FALLBACK)).toBe(FALLBACK);
  });

  it("cae al fallback con cero o negativos", () => {
    expect(toPositiveNumber("0", FALLBACK)).toBe(FALLBACK);
    expect(toPositiveNumber("-1000", FALLBACK)).toBe(FALLBACK);
  });
});
