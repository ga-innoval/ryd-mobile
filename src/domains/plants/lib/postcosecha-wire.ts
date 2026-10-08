import { parseDecimalText } from "./decimal-text";
import type { FrutaValues } from "./postcosecha-fruta";
import {
  postcosechaSchema,
  type PostcosechaSectionId,
} from "./postcosecha-schema";
import type { WirePayload } from "./respuesta-wire";

/**
 * Las dos fechas. Se guardan en ISO (`2026-08-12`) y vacías como `""`; en el
 * alambre, vacías son `null`.
 *
 * Tipadas con `keyof FrutaValues` a propósito: es lo que convierte renombrar un
 * campo del esquema en un error de compilación en vez de un dato que viaja mal
 * en silencio. Lo que el tipo **no** puede atrapar es un campo nuevo, así que un
 * peso que se añada al esquema hay que añadirlo aquí también.
 */
const FECHA_FIELDS: (keyof FrutaValues)[] = [
  "fecha_empaque",
  "fecha_evaluacion",
];

/**
 * Los cuatro pesos, en gramos, **tal como se teclean**: texto en SQLite y número
 * o `null` en el alambre. Es la misma frontera que cruzan las lecturas de Brix y
 * los pesos de Criba, solo que aquí el esquema no la cruza por su cuenta —
 * `pesoSchema` es `z.string()` sin `transform`, porque `summarizeFrutaPesos` ya
 * hacía la conversión por su lado—.
 */
const PESO_FIELDS: (keyof FrutaValues)[] = [
  "peso_inicial",
  "peso_final",
  "peso_bayas_reventadas",
  "peso_desgrane",
];

/**
 * Lo capturado de una sección de post-cosecha, en la forma del contrato.
 *
 * Hermano de `toRespuestaWirePayload` y con sus mismas reglas: `null` nunca es
 * `0`, los derivados no viajan y una sección ilegible devuelve `null` en vez de
 * mandar huecos.
 *
 * **Los tres porcentajes no se mandan**: deshidratación, bayas reventadas y
 * desgrane se calculan desde los cuatro pesos (`summarizeFrutaPesos`), así que
 * ya están implícitos en lo que viaja. Es el mismo movimiento que el peso de la
 * muestra de Criba.
 */
export function toPostcosechaWirePayload(
  seccion: PostcosechaSectionId,
  payload: unknown,
): WirePayload | null {
  switch (seccion) {
    case "fruta": {
      const parsed = postcosechaSchema.shape.fruta.safeParse(payload);
      if (!parsed.success) return null;

      const fruta = parsed.data;

      return Object.fromEntries(
        Object.keys(postcosechaSchema.shape.fruta.shape).map((key) => {
          const field = key as keyof FrutaValues;
          const value = fruta[field];

          if (FECHA_FIELDS.includes(field)) {
            return [field, value === "" ? null : value];
          }

          if (PESO_FIELDS.includes(field)) {
            return [field, parseDecimalText(String(value ?? ""))];
          }

          // Niveles y escalas: el slug del catálogo y el entero de 1 a 5 tal
          // cual. Sin contestar es `undefined` en el formulario y `null` aquí —
          // en el alambre no hay «ausente», solo «sin dato».
          return [field, value ?? null];
        }),
      );
    }

    case "comentarios": {
      const parsed = postcosechaSchema.shape.comentarios.safeParse(payload);
      if (!parsed.success) return null;

      return parsed.data;
    }
  }
}
