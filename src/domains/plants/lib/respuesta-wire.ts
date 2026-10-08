import { CRIBA_CALIBRE_SIXTEENTHS } from "./criba";
import {
  evaluationSchema,
  type EvaluationSectionId,
} from "./evaluation-schema";

/**
 * Lo capturado de una sección, pasado a la forma del contrato
 * (`docs/contrato-respuestas.md`).
 *
 * **La tablet y el alambre guardan formas distintas a propósito.** En SQLite
 * vive lo que se tecleó (`z.input`): las lecturas como texto, un `"14."` a medio
 * escribir incluido, porque reabrir la pantalla tiene que enseñar exactamente
 * eso. En el alambre viajan números y `null`, porque del otro lado se suman por
 * miles de filas. Este es el único sitio donde se cruza esa frontera — por eso
 * está en `lib/`, puro y con tests, y no dentro del guardado ni de la mutation.
 *
 * Lo que zod ya resuelve, porque el lado `z.output` del esquema está separado
 * desde el principio: el texto a número o `null` (`decimalTextSchema`), con el
 * vacío y lo que todavía no es un número contando como sin capturar. Lo que hay
 * que poner por encima es lo que el formulario no necesita guardar:
 *
 * - **`numero`**, que sale del índice del array. En SQLite no está porque la
 *   posición ya lo dice; en el alambre sí, porque el servidor guarda filas y
 *   una fila necesita decir de qué corte es.
 * - **El calibre**, por lo mismo: la posición lo identifica aquí, y allá no.
 * - **`fecha: "" → null`**. En local el vacío es `""`; en el alambre, `null`.
 *
 * Y lo que **no** se añade: R1–R5, los promedios, el peso de la muestra y la
 * distribución por calibre. Son derivados y se calculan al consultar — guardarlos
 * es garantizar que un día discrepen de sus insumos.
 */
export type WirePayload = Record<string, unknown>;

/**
 * `null` cuando el payload guardado no encaja con su esquema.
 *
 * Es el mismo portero que `buildEvaluationFromRespuestas`, que ante una sección
 * ilegible la enseña en blanco **sin tocar su fila**: aquí, no se manda y se
 * queda pendiente. Lo contrario —mandar `null`s donde no se pudo leer—
 * convertiría un dato ilegible en un dato vacío, y en el reporte eso es
 * indistinguible de una pregunta que nadie contestó.
 *
 * Con lo que escribe la app de hoy no debería pasar nunca: `sanitizeDecimalText`
 * impide teclear algo que no sea un número y los dos arrays tienen su mínimo
 * garantizado por la pantalla. Lo que sí puede llegar aquí es una sección
 * guardada por una versión anterior del formulario.
 */
export function toRespuestaWirePayload(
  seccion: EvaluationSectionId,
  payload: unknown,
): WirePayload | null {
  switch (seccion) {
    case "exterior":
    case "interior": {
      const schema = evaluationSchema.shape[seccion];
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return null;

      // Las preguntas del catálogo **todas**, y las que falten en `null`. El
      // esquema las tiene `.optional()`, así que una sección guardada antes de
      // que existiera una pregunta no la trae; omitirla en el alambre dejaría al
      // servidor sin saber si no se contestó o si la app no la conoce.
      const answers = parsed.data as Record<string, string | undefined>;

      return Object.fromEntries(
        Object.keys(schema.shape).map((id) => [id, answers[id] ?? null]),
      );
    }

    case "brix": {
      const parsed = evaluationSchema.shape.brix.safeParse(payload);
      if (!parsed.success) return null;

      return {
        cortes: parsed.data.cortes.map((corte, index) => ({
          numero: index + 1,
          lecturas: corte.readings,
        })),
      };
    }

    case "criba": {
      const parsed = evaluationSchema.shape.criba.safeParse(payload);
      if (!parsed.success) return null;

      return {
        calibres: parsed.data.calibres.map((calibre, index) => ({
          // **El numerador sobre 16**, que es la escala real de los doce: los
          // nueve de siempre son 8/16 a 16/16 y los tres grandes siguen en
          // ella —1 1/8 es 18/16—. Así el contrato conserva un solo
          // `IntegerField` que ordena y agrupa bien, y los calibres extra
          // dejan de quedarse fuera del alambre. Que se quedaran fuera no era
          // solo perder tres filas: suman al peso de la muestra, que el
          // servidor **deriva** de lo que recibe, así que el reporte habría
          // dado un peso distinto al de la tablet.
          calibre: CRIBA_CALIBRE_SIXTEENTHS[index] ?? null,
          peso_total: calibre.total,
          peso_promedio: calibre.average,
        })),
      };
    }

    case "rendimiento": {
      const parsed = evaluationSchema.shape.rendimiento.safeParse(payload);
      if (!parsed.success) return null;

      return {
        cortes: parsed.data.cortes.map((corte, index) => ({
          numero: index + 1,
          fecha: corte.fecha === "" ? null : corte.fecha,
          kilogramos: corte.kilogramos,
          racimos: corte.racimos,
        })),
      };
    }

    case "comentarios": {
      const parsed = evaluationSchema.shape.comentarios.safeParse(payload);
      if (!parsed.success) return null;

      // Las tres siempre, tal cual. La cadena vacía significa «se escribió y se
      // borró»; que la sección nunca se haya enviado es lo que significa «sin
      // capturar», y eso lo dice la ausencia de la fila, no un `null` aquí.
      return parsed.data;
    }
  }
}
