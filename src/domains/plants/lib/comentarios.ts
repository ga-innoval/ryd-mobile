import { z } from "zod";

/**
 * Las notas que el evaluador escribe al cerrar la visita.
 *
 * Catálogo y no tres campos sueltos por lo mismo que las preguntas: la sección
 * se pinta recorriéndolo, así que agregar o renombrar una nota es tocar solo
 * esta lista. La marca de agua es la pista de qué escribir en cada una, y por
 * eso desaparece en cuanto hay texto.
 */
export const COMENTARIO_FIELDS = [
  {
    key: "positivos",
    label: "Comentarios positivos (👍)",
    placeholder: "Ej: Sabor, color, firmeza o presentación de la fruta.",
  },
  {
    key: "negativos",
    label: "Comentarios negativos (👎)",
    placeholder:
      "Ej: Falta de estructura, desuniformidad, partidura u otros defectos.",
  },
  {
    key: "observaciones",
    label: "Observaciones",
    placeholder:
      "Ej: Datos relevantes que no entran en los dos campos anteriores.",
  },
] as const;

export type ComentarioKey = (typeof COMENTARIO_FIELDS)[number]["key"];

/** Las tres notas, tal como se capturan y como se guardan: texto libre. */
export const comentariosSchema = z.object({
  positivos: z.string(),
  negativos: z.string(),
  observaciones: z.string(),
});

/** Las tres notas en blanco. */
export function createComentarios(): Record<ComentarioKey, string> {
  return { positivos: "", negativos: "", observaciones: "" };
}

/**
 * Cuántas notas llevan algo escrito.
 *
 * Lo que solo tiene espacios no cuenta: vacío nunca es una nota, y un salto de
 * línea suelto lo dejaría contado. Ninguna es obligatoria, así que esta cuenta
 * informa y no exige.
 */
export function countWrittenComentarios(
  comentarios: Record<ComentarioKey, string>,
): number {
  return COMENTARIO_FIELDS.filter(
    ({ key }) => (comentarios[key] ?? "").trim() !== "",
  ).length;
}
