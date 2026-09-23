import { formatISODate, parseISODate, toISODate } from "../dates";

describe("toISODate", () => {
  // En hora local: con `toISOString()`, una fecha elegida de noche en México se
  // guardaría como el día siguiente.
  it("guarda el día que se eligió, no el de UTC", () => {
    expect(toISODate(new Date(2026, 7, 12, 23, 30))).toBe("2026-08-12");
  });
});

describe("parseISODate", () => {
  it("lee una fecha ISO", () => {
    const date = parseISODate("2026-08-12");

    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(7);
    expect(date?.getDate()).toBe(12);
  });

  it("devuelve null sin fecha", () => {
    expect(parseISODate("")).toBeNull();
  });

  it("devuelve null con algo que no es una fecha", () => {
    expect(parseISODate("12/08/2026")).toBeNull();
    expect(parseISODate("2026-13-40")).toBeNull();
  });
});

describe("formatISODate", () => {
  it("muestra la fecha como se lee en campo", () => {
    expect(formatISODate("2026-08-12")).toBe("12/08/2026");
  });

  it("devuelve vacío si no hay fecha", () => {
    expect(formatISODate("")).toBe("");
  });
});
