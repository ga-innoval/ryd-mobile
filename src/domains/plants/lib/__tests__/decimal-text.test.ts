import {
  formatDecimal,
  parseDecimalText,
  sanitizeDecimalText,
} from "../decimal-text";

describe("sanitizeDecimalText", () => {
  it("convierte la coma en punto", () => {
    expect(sanitizeDecimalText("18,4", 6)).toBe("18.4");
  });

  it("descarta lo que no sea dígito o separador", () => {
    expect(sanitizeDecimalText("1a8 .4°", 6)).toBe("18.4");
  });

  it("deja un solo separador decimal", () => {
    expect(sanitizeDecimalText("18.4.5", 6)).toBe("18.45");
  });

  it("recorta al largo que le den", () => {
    expect(sanitizeDecimalText("1234.5678", 6)).toBe("1234.5");
    expect(sanitizeDecimalText("1234.5678", 7)).toBe("1234.56");
  });
});

describe("parseDecimalText", () => {
  it("devuelve null sin nada que leer", () => {
    expect(parseDecimalText("")).toBeNull();
    expect(parseDecimalText(".")).toBeNull();
  });

  it("lee un número a medio escribir", () => {
    expect(parseDecimalText("18.")).toBe(18);
  });
});

describe("formatDecimal", () => {
  it("muestra siempre los decimales que le piden", () => {
    expect(formatDecimal(18, 2)).toBe("18.00");
    expect(formatDecimal(818, 1)).toBe("818.0");
  });

  // `toFixed` a secas redondea el número binario, no el decimal: 186.45 se
  // guarda como 186.4499… y el motor lo baja a "186.4". Cuál es el valor que se
  // cuela depende del motor —V8 y Hermes no coinciden—, así que aquí se fija lo
  // nuestro y no lo suyo.
  it("redondea la mitad hacia arriba, como la cuenta a mano", () => {
    expect(formatDecimal(186.45, 1)).toBe("186.5");
    expect(formatDecimal(0.15, 1)).toBe("0.2");
    expect(formatDecimal(59.725, 2)).toBe("59.73");
  });
});
