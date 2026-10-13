import { formatPushSummary } from "../format-push-summary";

const resumen = (overrides = {}) =>
  formatPushSummary({
    enviadas: 0,
    fotos: 0,
    rechazadas: 0,
    pendientes: 0,
    ...overrides,
  });

describe("formatPushSummary", () => {
  it("cuenta lo que salió", () => {
    expect(resumen({ enviadas: 1 })).toBe("Se envió 1 sección.");
    expect(resumen({ enviadas: 3 })).toBe("Se enviaron 3 secciones.");
  });

  // Son unidades distintas y el evaluador las piensa distinto: «3 secciones»
  // no dice nada de si las fotografías salieron.
  it("nombra las fotografías aparte de las secciones", () => {
    expect(resumen({ enviadas: 3, fotos: 2 })).toBe(
      "Se enviaron 3 secciones y 2 fotografías.",
    );
    expect(resumen({ fotos: 1 })).toBe("Se envió 1 fotografía.");
    expect(resumen({ enviadas: 1, fotos: 1 })).toBe(
      "Se enviaron 1 sección y 1 fotografía.",
    );
  });

  // Lo que este aviso existe para evitar: que el evaluador se vaya del campo
  // creyendo que mandó todo.
  it("dice también lo que no salió", () => {
    expect(resumen({ enviadas: 2, pendientes: 1 })).toBe(
      "Se enviaron 2 secciones. 1 quedó sin enviar.",
    );
    expect(resumen({ enviadas: 2, fotos: 1, pendientes: 3 })).toBe(
      "Se enviaron 2 secciones y 1 fotografía. 3 quedaron sin enviar.",
    );
    expect(resumen({ enviadas: 2, rechazadas: 2 })).toBe(
      "Se enviaron 2 secciones. 2 quedaron rechazadas: la encuesta está cerrada.",
    );
  });

  it("un envío que no logró nada lo dice de frente", () => {
    expect(resumen({ pendientes: 4 })).toBe(
      "No salió nada. 4 quedaron sin enviar.",
    );
  });

  it("junta las tres cosas cuando pasan las tres", () => {
    expect(resumen({ enviadas: 1, rechazadas: 1, pendientes: 1 })).toBe(
      "Se envió 1 sección. 1 quedó rechazada: la encuesta está cerrada. 1 quedó sin enviar.",
    );
  });
});
