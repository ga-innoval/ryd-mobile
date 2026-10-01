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

/**
 * Las secciones con fila propia que reparten avance — hoy solo fruta.
 *
 * Existe para que el `WHERE` del listado y esta regla no puedan discrepar: si
 * mañana otra sección repartiera, entra aquí y las dos se enteran.
 */
export const POSTCOSECHA_PROGRESS_SECTIONS = ["fruta"] as const;

/** La clave con la que se dirige una evaluación: la plantación **y** cuál de
 *  las cuatro. Ninguna de las dos basta sola. */
export function postcosechaKey(plantId: string, evalId: string): string {
  return `${plantId}:${evalId}`;
}

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
 * Quien la lee del listado deshace la división: ver `postcosechaProgressFromRow`.
 *
 * Recibe el payload como `unknown` porque se le pregunta igual por lo que hay en
 * pantalla y por lo que sale de SQLite: lo que no encaje cuenta como cero, no
 * como error.
 */
export function postcosechaSeccionProgress(
  seccion: string,
  payload: unknown,
): number {
  if (!POSTCOSECHA_PROGRESS_SECTIONS.some((id) => id === seccion)) return 0;
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
 * **Una evaluación en blanco abre en cero**, incluidos los tres porcentajes: su
 * barra distingue «sin capturar» de «0 %», así que un cero medido cuenta y un
 * campo que nadie tocó, no. Hubo un tiempo en que no lo distinguía y una
 * evaluación recién abierta enseñaba un 25 % que nadie había capturado; hay test
 * de los dos lados.
 */
export function postcosechaProgress(
  values: PostcosechaFormValues,
  tomasConFoto: number,
): number {
  const tomas = Math.min(tomasConFoto, POSTCOSECHA_PHOTO_CATEGORIES.length);

  return share(frutaAnswered(values.fruta) + tomas, POSTCOSECHA_TOTAL_UNIDADES);
}

/**
 * El avance de una evaluación reconstruido desde SQLite: la columna `progress`
 * de su fila `fruta` y cuántas tomas llevan fotografía.
 *
 * Es el camino del listado, que no puede abrir payloads —los pregunta de todas
 * las plantaciones a la vez—, mientras que la pantalla calcula sobre los valores
 * vivos. Los dos tienen que dar el mismo número.
 *
 * **Y lo dan exacto, no aproximado.** La columna guarda
 * `round(contestadas / 11 × 100)`, y esos doce valores —0, 9, 18, 27, 36, 45,
 * 55, 64, 73, 82, 91, 100— están lo bastante separados como para no pisarse:
 * `round(progress × 11 / 100)` devuelve el conteo original en los doce casos.
 * Hay un test que lo recorre entero, porque es la clase de propiedad que se
 * rompe en silencio si alguien cambia cuántas preguntas tiene la sección.
 */
export function postcosechaProgressFromRow(
  frutaProgress: number,
  tomasConFoto: number,
): number {
  const contestadas = Math.round((frutaProgress * FRUTA_TOTAL_PREGUNTAS) / 100);
  const tomas = Math.min(tomasConFoto, POSTCOSECHA_PHOTO_CATEGORIES.length);

  return share(contestadas + tomas, POSTCOSECHA_TOTAL_UNIDADES);
}
