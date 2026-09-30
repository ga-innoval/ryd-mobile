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

/**
 * El avance de una plantación, de 0 a 1.
 *
 * **Por ahora solo cuentan los tratamientos**, aunque la post-cosecha ya se
 * captura y su avance ya está calculado por evaluación
 * (`getPostcosechaProgress`, que es lo que pinta las barras de sus tarjetas).
 * Falta el reparto 50/50, y se dejó aparte a propósito: el día que entre, la
 * barra de toda plantación en campaña cae a la mitad y se mueven los contadores
 * de «Sin iniciar» / «Iniciadas». Cuando entre, esto pasa a ser la media de los
 * dos bloques —cada uno prorrateado por dentro— y el resto de la app no se
 * entera.
 *
 * Una plantación sin tratamientos es cero y no un hueco: no hay nada capturado.
 */
export function plantProgress(tratamientos: { progress: number }[]): number {
  if (tratamientos.length === 0) return 0;

  const total = tratamientos.reduce(
    (sum, tratamiento) => sum + tratamiento.progress,
    0,
  );

  return total / tratamientos.length;
}
