import {
  FRUTA_TOTAL_PREGUNTAS,
  frutaAnswered,
  type FrutaValues,
} from "./postcosecha-fruta";
import { POSTCOSECHA_PHOTO_CATEGORIES } from "./postcosecha-photo-categories";
import type { PostcosechaFormValues } from "./postcosecha-schema";

/**
 * Lo que reparte el avance de una evaluación de post-cosecha: las once preguntas
 * de fruta y la única toma de fotografía, **todas pesando lo mismo**.
 *
 * **Aquí no se reparte por secciones, como en tratamiento.** Allí cada una de
 * las seis vale un sexto y funciona porque están parejas; aquí serían dos, así
 * que adjuntar una fotografía valdría el 50 % de la evaluación y contestar diez
 * de las once preguntas, el 45 %. El principio que la regla de tratamiento sirve
 * no es «las secciones valen igual», es «la barra dice cuánto trabajo llevas»;
 * con secciones de once y de una, el reparto uniforme traiciona justo eso.
 *
 * **Comentarios no reparte**, igual que en tratamiento: sus tres notas son
 * libres y ninguna es obligatoria, así que contarlas haría que el 100 % exigiera
 * escribir texto que el negocio no pide.
 */
export const POSTCOSECHA_TOTAL_UNIDADES =
  FRUTA_TOTAL_PREGUNTAS + POSTCOSECHA_PHOTO_CATEGORIES.length;

const share = (done: number, total: number) =>
  total === 0 ? 0 : Math.min(1, done / total);

/**
 * Lo que lleva llena una sección, de 0 a 1 — **su propio relleno, sin el peso
 * que tiene dentro de la evaluación**.
 *
 * Es lo que se guarda en la columna `progress` al escribir la fila, y por eso no
 * lleva el peso puesto: cambiar cuánto vale una sección no puede obligar a
 * reescribir filas. Quien las combine aplica el peso al leer, que es lo que hace
 * `postcosechaProgress`.
 *
 * El día que el listado lo combine en SQL tendrá que deshacer esta división
 * (`progress/100 × 11`), y eso arrastra hasta medio punto de error en el
 * conteo porque la columna es entera. Con el porcentaje redondeado que se
 * enseña casi siempre da igual; si algún día hiciera falta el número exacto, lo
 * que hay que cambiar es qué guarda la columna —el conteo en vez del
 * porcentaje—, no cómo se lee.
 *
 * Recibe el payload como `unknown` porque se le pregunta igual por lo que hay en
 * pantalla y por lo que sale de SQLite: lo que no encaje cuenta como cero, no
 * como error.
 */
export function postcosechaSeccionProgress(
  seccion: string,
  payload: unknown,
): number {
  if (seccion !== "fruta") return 0;
  if (payload === null || typeof payload !== "object") return 0;

  return share(frutaAnswered(payload as FrutaValues), FRUTA_TOTAL_PREGUNTAS);
}

/**
 * El avance de una evaluación entera, de 0 a 1.
 *
 * Las tomas con fotografía se pasan aparte y como conteo, por lo mismo que en
 * tratamiento: no viven en el formulario sino en su propia tabla, y quien las
 * cuenta lo hace como puede —la pantalla agrupando en memoria, el listado con un
 * `COUNT` en SQL—.
 *
 * **Una evaluación en blanco no abre en cero, abre en 3 de 12.** Los tres
 * porcentajes no tienen estado vacío: arrancan en 0 y desde el primer frame
 * llevan dato, así que cuentan como contestados —es la misma razón por la que
 * `frutaAnswered` abre en 3, y está fijada con test—. Lo que **no** pasa es que
 * eso ensucie el listado: abrir una evaluación y salir no escribe ninguna fila,
 * y sin fila el avance guardado sigue siendo cero.
 */
export function postcosechaProgress(
  values: PostcosechaFormValues,
  tomasConFoto: number,
): number {
  const tomas = Math.min(tomasConFoto, POSTCOSECHA_PHOTO_CATEGORIES.length);

  return share(
    frutaAnswered(values.fruta) + tomas,
    POSTCOSECHA_TOTAL_UNIDADES,
  );
}
