import { z } from "zod";
import type { EvalQuestion } from "../types";
import { brixCorteSchema, createBrixCorte } from "./brix";
import {
  createCribaCalibres,
  cribaCalibreSchema,
  CRIBA_CALIBRES,
} from "./criba";
import { comentariosSchema, createComentarios } from "./comentarios";
import { createRendimientoCorte, rendimientoCorteSchema } from "./rendimiento";
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
  criba: z.object({
    // Los nueve calibres siempre, en orden: la tabla es fija y es su posición
    // la que dice de qué calibre es cada peso. Lo que no se capturó va vacío.
    calibres: z.array(cribaCalibreSchema).length(CRIBA_CALIBRES.length),
  }),
  rendimiento: z.object({
    // Nunca vacío: la pantalla arranca con un corte y no deja descartar el
    // único. Sin tope por arriba, que está sin confirmar con el negocio.
    cortes: z.array(rendimientoCorteSchema).min(1),
  }),
  // Texto libre, y ninguna obligatoria: son las notas del evaluador.
  comentarios: comentariosSchema,
});

/** Lo que tienen los campos mientras se captura: las lecturas, como texto. */
export type EvaluationFormValues = z.input<typeof evaluationSchema>;

/** Lo que sale al guardar, ya validado: las lecturas, como números o `null`. */
export type EvaluationValues = z.output<typeof evaluationSchema>;

/** El `id` de cada sección tiene que ser una de estas claves. */
export type EvaluationSectionId = keyof EvaluationFormValues;

/**
 * Las secciones, derivadas del esquema y no escritas a mano: una sección nueva
 * entra sola en el guardado y en la comparación de cambios.
 */
export const EVALUATION_SECTION_IDS = Object.keys(
  evaluationSchema.shape,
) as EvaluationSectionId[];

/**
 * Las secciones que son un catálogo de preguntas. Brix va por cortes, Criba por
 * calibres, Rendimiento por cosechas y Comentarios por notas de texto libre,
 * así que quedan fuera y el tipo obliga a tratarlas aparte.
 */
export type QuestionsSectionId = Exclude<
  EvaluationSectionId,
  "brix" | "criba" | "rendimiento" | "comentarios"
>;

/**
 * Una evaluación en blanco. Devuelve objetos nuevos en cada llamada, a propósito:
 * `reset()` compartiría arrays con el valor anterior si se reutilizaran.
 */
export function buildEvaluationDefaults(): EvaluationFormValues {
  return {
    exterior: {},
    interior: {},
    brix: { cortes: [createBrixCorte()] },
    criba: { calibres: createCribaCalibres() },
    rendimiento: { cortes: [createRendimientoCorte()] },
    comentarios: createComentarios(),
  };
}
