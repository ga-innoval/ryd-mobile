import { z } from "zod";
import { comentariosSchema, createComentarios } from "./comentarios";
import { buildFrutaDefaults, frutaSchema } from "./postcosecha-fruta";

/**
 * Una evaluación de post-cosecha: una clave por sección, que es también el `id`
 * de la sección en pantalla y el valor de la columna `seccion` en SQLite.
 *
 * **Sin el par `z.input` / `z.output` de tratamiento.** Allí existe porque las
 * lecturas se teclean y hay que conservar `"14."` a medio escribir, así que lo
 * capturado y lo validado son tipos distintos. Aquí ningún número sale de un
 * campo de texto —los porcentajes vienen del slider, las estrellas del
 * `StarRating` y las fechas ya llegan en ISO del `DateField`—, de modo que los
 * dos serían el mismo tipo y una capa de conversión no haría nada.
 *
 * **Las fotografías no son una sección de aquí** aunque lo parezcan en pantalla:
 * son archivos, viven en `postcosecha_fotos` y se guardan al capturarse. Por eso
 * no tienen clave en este esquema, igual que en tratamiento.
 */
export const postcosechaSchema = z.object({
  fruta: frutaSchema,
  comentarios: comentariosSchema,
});

/** Lo capturado de una evaluación, tal como lo lleva el formulario. */
export type PostcosechaFormValues = z.infer<typeof postcosechaSchema>;

export type PostcosechaSectionId = keyof PostcosechaFormValues;

/**
 * Las secciones que se guardan, derivadas del esquema y no escritas a mano: una
 * sección nueva entra sola en el guardado y en la comparación de cambios.
 */
export const POSTCOSECHA_SECTION_IDS = Object.keys(
  postcosechaSchema.shape,
) as PostcosechaSectionId[];

/**
 * Una evaluación en blanco.
 *
 * Objetos nuevos en cada llamada, a propósito: `reset()` compartiría referencias
 * con el valor anterior si se reutilizaran.
 */
export function buildPostcosechaDefaults(): PostcosechaFormValues {
  return {
    fruta: buildFrutaDefaults(),
    comentarios: createComentarios(),
  };
}
