import { formatPushSummary } from "../format-push-summary";

const resumen = (overrides = {}) =>
  formatPushSummary({
    enviadas: 0,
    rechazadas: 0,
    pendientes: 0,
    ...overrides,
  });

describe("formatPushSummary", () => {
  it("cuenta lo que salió", () => {
    expect(resumen({ enviadas: 1 })).toBe("Se envió 1 sección.");
    expect(resumen({ enviadas: 3 })).toBe("Se enviaron 3 secciones.");
  });

  // Lo que este aviso existe para evitar: que el evaluador se vaya del campo
  // creyendo que mandó todo.
  it("dice también lo que no salió", () => {
    expect(resumen({ enviadas: 2, pendientes: 1 })).toBe(
      "Se enviaron 2 secciones. 1 sección sigue pendiente.",
    );
    expect(resumen({ enviadas: 2, rechazadas: 2 })).toBe(
      "Se enviaron 2 secciones. 2 secciones quedaron rechazadas: la encuesta está cerrada.",
    );
  });

  it("un envío que no logró nada lo dice de frente", () => {
    expect(resumen({ pendientes: 4 })).toBe(
      "No salió ninguna sección. 4 secciones siguen pendientes.",
    );
  });

  it("junta las tres cosas cuando pasan las tres", () => {
    expect(resumen({ enviadas: 1, rechazadas: 1, pendientes: 1 })).toBe(
      "Se envió 1 sección. 1 sección quedó rechazada: la encuesta está cerrada. 1 sección sigue pendiente.",
    );
  });
});
