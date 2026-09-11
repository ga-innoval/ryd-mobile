import { calcEvalProgress } from "../calc-eval-progress";
import type { EvalQuestion } from "../../types";

const question = (id: string): EvalQuestion => ({
  id,
  label: id,
  options: [{ label: "Sí", value: "si" }],
});

const QUESTIONS = ["q1", "q2", "q3", "q4"].map(question);

describe("calcEvalProgress", () => {
  it("devuelve 0 sin respuestas", () => {
    expect(calcEvalProgress(QUESTIONS, {})).toBe(0);
  });

  it("prorratea sobre el total de la sección", () => {
    expect(calcEvalProgress(QUESTIONS, { q1: "si", q2: "si" })).toBe(50);
  });

  it("devuelve 100 con todas contestadas", () => {
    const todas = { q1: "si", q2: "si", q3: "si", q4: "si" };
    expect(calcEvalProgress(QUESTIONS, todas)).toBe(100);
  });

  // Deseleccionar no borra la clave, la deja en `undefined`. Contando claves
  // el progreso nunca bajaría.
  it("descuenta una respuesta deseleccionada", () => {
    const answers = { q1: "si", q2: undefined };
    expect(calcEvalProgress(QUESTIONS, answers)).toBe(25);
  });

  // `answers` es un único record para todas las secciones.
  it("ignora respuestas de otra sección", () => {
    const answers = { q1: "si", otra_seccion: "si", y_otra: "si" };
    expect(calcEvalProgress(QUESTIONS, answers)).toBe(25);
  });

  it("redondea a entero", () => {
    // 1 de 3 son 33.33…
    expect(calcEvalProgress(QUESTIONS.slice(0, 3), { q1: "si" })).toBe(33);
  });

  // Un catálogo vacío daría NaN, y ese NaN llegaría hasta la barra.
  it("devuelve 0 con un catálogo vacío", () => {
    expect(calcEvalProgress([], { q1: "si" })).toBe(0);
  });
});
