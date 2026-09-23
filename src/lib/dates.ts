import { format, isValid, parse } from "date-fns";

/**
 * Las fechas que se capturan a mano viajan como texto ISO (`2026-08-12`) y se
 * muestran como `12/08/2026`.
 *
 * ISO para guardar porque ordena bien como texto y no depende de cómo tenga
 * configurada la tablet el evaluador; el formato de pantalla es el que se lee
 * en campo.
 */
const ISO_DATE = "yyyy-MM-dd";
const DISPLAY_DATE = "dd/MM/yyyy";

/**
 * La fecha de un `Date` en ISO, **en hora local**.
 *
 * Con `toISOString()` no: pasa por UTC, así que una fecha elegida a las once de
 * la noche en México se guardaría como el día siguiente.
 */
export function toISODate(date: Date): string {
  return format(date, ISO_DATE);
}

/** `null` si está vacía o no es una fecha ISO válida. */
export function parseISODate(value: string): Date | null {
  if (value === "") return null;

  const date = parse(value, ISO_DATE, new Date());
  return isValid(date) ? date : null;
}

/** La fecha como se lee en campo, o cadena vacía si no hay ninguna. */
export function formatISODate(value: string): string {
  const date = parseISODate(value);

  return date === null ? "" : format(date, DISPLAY_DATE);
}
