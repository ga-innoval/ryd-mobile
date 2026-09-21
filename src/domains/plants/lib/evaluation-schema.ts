import { z } from "zod";
import type { EvalQuestion } from "../types";
import { brixCorteSchema, createBrixCorte } from "./brix";
import { EVALS_EXTERIOR } from "./evals-exterior";
import { EVALS_INTERIOR } from "./evals-interior";

/**
 * Una sección de preguntas, derivada de su catálogo: cada pregunta solo acepta
 * los `value` de sus propias opciones. Antes cualquier string entraba.
 *
 * Derivarla es lo que hace que agregar una pregunta sea tocar solo el catálogo:
 * el esquema la recoge sola.
 *
 * TODO(obligatorias): hoy todas son opcionales. Cuando `EvalQuestion` sepa cuáles
 * son obligatorias, esas pierden el `.optional()` aquí y en ningún otro sitio.
 */
export function buildQuestionsSchema(questions: EvalQuestion[]) {
  return z.object(
    Object.fromEntries(
      questions.map((question) => [
        question.id,
        z.enum(question.options.map((option) => option.value)).optional(),
      ]),
    ),
  );
}

/**
 * La evaluación entera: una clave por sección, que es también el `id` de la
 * sección en pantalla.
 *
 * Es el esquema de lo que **bloquea el guardado**. Los avisos que no bloquean —el
 * rango de Brix— van por su propio esquema (`brixReadingRangeSchema`) y no deben
 * entrar aquí.
 */
export const evaluationSchema = z.object({
  exterior: buildQuestionsSchema(EVALS_EXTERIOR),
  interior: buildQuestionsSchema(EVALS_INTERIOR),
  brix: z.object({
    // Nunca vacío: la pantalla arranca con un corte y no deja descartar el
    // único. Aquí queda escrito como invariante del dato.
    cortes: z.array(brixCorteSchema).min(1),
  }),
});

/** Lo que tienen los campos mientras se captura: las lecturas, como texto. */
export type EvaluationFormValues = z.input<typeof evaluationSchema>;

/** Lo que sale al guardar, ya validado: las lecturas, como números o `null`. */
export type EvaluationValues = z.output<typeof evaluationSchema>;

/** El `id` de cada sección tiene que ser una de estas claves. */
export type EvaluationSectionId = keyof EvaluationFormValues;

/** Las secciones que son un catálogo de preguntas; Brix va por cortes. */
export type QuestionsSectionId = Exclude<EvaluationSectionId, "brix">;

/**
 * Una evaluación en blanco. Devuelve objetos nuevos en cada llamada, a propósito:
 * `reset()` compartiría arrays con el valor anterior si se reutilizaran.
 */
export function buildEvaluationDefaults(): EvaluationFormValues {
  return {
    exterior: {},
    interior: {},
    brix: { cortes: [createBrixCorte()] },
  };
}
