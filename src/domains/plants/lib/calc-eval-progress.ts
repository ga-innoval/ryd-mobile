import type { EvalAnswers, EvalQuestion } from "../types";

/**
 * Porcentaje contestado de una sección, de 0 a 100.
 *
 * Recorre el catálogo de la sección en vez de contar las claves de `answers`,
 * y no es un detalle de estilo: `answers` es un único record compartido por
 * todas las secciones, así que contar claves incluiría las de las demás. Y
 * mira el **valor**, no la presencia de la clave, porque deseleccionar una
 * opción deja la clave puesta con `undefined` — contando claves el progreso
 * nunca bajaría.
 *
 * Devuelve un entero para que la barra y el número que se muestra salgan del
 * mismo dato y no puedan discrepar.
 */
export function calcEvalProgress(
  questions: EvalQuestion[],
  answers: EvalAnswers,
): number {
  if (questions.length === 0) return 0;

  const answered = questions.filter(
    (question) => answers[question.id] !== undefined,
  ).length;

  return Math.round((answered / questions.length) * 100);
}
