import { BRIX_READINGS_PER_CORTE } from "./brix";
import { CRIBA_CALIBRES, summarizeCriba } from "./criba";
import { EVALS_EXTERIOR } from "./evals-exterior";
import { EVALS_INTERIOR } from "./evals-interior";
import { PHOTO_CATEGORIES } from "./photo-categories";
import type { EvaluationFormValues } from "./evaluation-schema";

/**
 * Las secciones que reparten el avance, un sexto cada una.
 *
 * **Comentarios queda fuera**: sus tres notas son libres y ninguna es
 * obligatoria, así que contarlas haría que llegar al 100 % exigiera escribir
 * texto que el negocio no pide.
 */
export const PROGRESS_SECTIONS = [
  "fotografias",
  "exterior",
  "interior",
  "brix",
  "criba",
  "rendimiento",
] as const;

export type ProgressSection = (typeof PROGRESS_SECTIONS)[number];

/** Cuántos datos espera cada sección para darse por llena. */
const RENDIMIENTO_FIELDS_PER_CORTE = 3;

const share = (done: number, total: number) =>
  total === 0 ? 0 : Math.min(1, done / total);

const answeredOf = (answers: unknown, ids: string[]) => {
  const record = (answers ?? {}) as Record<string, string | undefined>;

  // Mira el valor y no la clave: deseleccionar deja la clave puesta en
  // `undefined`, y contando claves el avance no bajaría nunca.
  return ids.filter((id) => record[id] !== undefined).length;
};

/**
 * Lo que lleva capturado una sección, de 0 a 1.
 *
 * **En Brix y Rendimiento el denominador es siempre el primer corte**, no los
 * que haya. Solo se puede agregar un corte cuando el anterior está terminado,
 * así que el mínimo capturable es uno y los demás son trabajo extra que no
 * mueve la barra. Con el denominador creciendo, agregar un corte **haría
 * retroceder el avance**, que es lo único que una barra no puede hacer.
 *
 * Recibe el payload como `unknown` porque se le pregunta igual por lo que hay
 * en pantalla y por lo que sale de SQLite, que es texto hasta que alguien lo
 * valida: lo que no encaje cuenta como cero, no como error.
 */
export function seccionProgress(seccion: string, payload: unknown): number {
  switch (seccion) {
    case "exterior":
      return share(
        answeredOf(
          payload,
          EVALS_EXTERIOR.map((q) => q.id),
        ),
        EVALS_EXTERIOR.length,
      );

    case "interior":
      return share(
        answeredOf(
          payload,
          EVALS_INTERIOR.map((q) => q.id),
        ),
        EVALS_INTERIOR.length,
      );

    case "criba": {
      const calibres = (payload as EvaluationFormValues["criba"] | undefined)
        ?.calibres;
      if (!Array.isArray(calibres)) return 0;

      return share(
        summarizeCriba(calibres).completeCount,
        CRIBA_CALIBRES.length,
      );
    }

    case "brix": {
      const readings = (payload as EvaluationFormValues["brix"] | undefined)
        ?.cortes?.[0]?.readings;
      if (!Array.isArray(readings)) return 0;

      return share(
        readings.filter((reading) => reading.trim() !== "").length,
        BRIX_READINGS_PER_CORTE,
      );
    }

    case "rendimiento": {
      const corte = (payload as EvaluationFormValues["rendimiento"] | undefined)
        ?.cortes?.[0];
      if (!corte) return 0;

      const done = [corte.fecha, corte.kilogramos, corte.racimos].filter(
        (value) => typeof value === "string" && value.trim() !== "",
      ).length;

      return share(done, RENDIMIENTO_FIELDS_PER_CORTE);
    }

    case "fotografias": {
      const photos = (payload ?? {}) as Record<string, unknown>;
      const withPhotos = PHOTO_CATEGORIES.filter(
        (category) =>
          Array.isArray(photos[category.id]) &&
          (photos[category.id] as unknown[]).length > 0,
      ).length;

      return fotografiasProgress(withPhotos);
    }

    default:
      return 0;
  }
}

/**
 * El sexto de fotografías a partir de cuántas tomas del catálogo llevan al menos
 * una. Una toma cuenta con que tenga una: cuántas hacen falta de cada una no lo
 * dice el negocio.
 *
 * Recibe el conteo y no las fotografías porque lo preguntan dos sitios que no
 * tienen el dato en la misma forma: la pantalla, que las tiene agrupadas en
 * memoria, y el listado, que solo sabe contarlas en SQL. Partirlo así es lo que
 * evita escribir la misma regla por tercera vez.
 */
export function fotografiasProgress(categoriasConFoto: number): number {
  return share(categoriasConFoto, PHOTO_CATEGORIES.length);
}

/**
 * El avance de una evaluación entera, de 0 a 1: el promedio de las seis
 * secciones que reparten.
 *
 * Las fotografías se pasan aparte porque no viven en el formulario sino en su
 * propio store (`photos-store.ts`).
 */
export function evaluationProgress(
  values: EvaluationFormValues,
  photos: Record<string, readonly unknown[]>,
): number {
  const total = PROGRESS_SECTIONS.reduce(
    (sum, seccion) =>
      sum +
      seccionProgress(
        seccion,
        seccion === "fotografias"
          ? photos
          : values[seccion as keyof EvaluationFormValues],
      ),
    0,
  );

  return total / PROGRESS_SECTIONS.length;
}

/** El avance como lo enseña la interfaz: entero, para que la barra y cualquier
 *  número que se muestre salgan del mismo dato. */
export function formatProgress(progress: number): number {
  return Math.round(progress * 100);
}

const media = (valores: number[]) =>
  valores.length === 0
    ? null
    : valores.reduce((suma, valor) => suma + valor, 0) / valores.length;

/**
 * El avance de una plantación, de 0 a 1: **mitad tratamientos, mitad
 * post-cosecha**.
 *
 * Cada bloque se prorratea por dentro con sus propias unidades, así que tener
 * toda la post-cosecha capturada vale 50 % de la plantación por mucho que los
 * tratamientos sigan en blanco, y al revés. Dentro de cada bloque todas las
 * capturas pesan igual: tres tratamientos con uno completo son `(1/3) × 50 %`, y
 * el denominador de post-cosecha es siempre 4, porque su catálogo es fijo.
 *
 * **Si un bloque no existe, el otro se queda con todo.** Una plantación sin
 * tratamientos configurados no tiene ahí trabajo pendiente, es que no hay nada
 * que capturar: repartirle igualmente su mitad dejaría la tarjeta con un tope
 * del 50 % que el evaluador no podría subir haga lo que haga. Es el caso que la
 * regla del negocio no contempla, y se resuelve así a propósito.
 *
 * Sin nada de nada —ni tratamientos ni evaluaciones— es cero, no un hueco.
 */
export function plantProgress(
  tratamientos: { progress: number }[],
  postcosecha: number[],
): number {
  const bloques = [
    media(tratamientos.map((t) => t.progress)),
    media(postcosecha),
  ].filter((bloque): bloque is number => bloque !== null);

  return media(bloques) ?? 0;
}
