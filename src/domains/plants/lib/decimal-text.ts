import { z } from "zod";

/**
 * Los campos numéricos que se capturan como texto: la máscara al teclear, la
 * lectura a número y el formato al mostrar.
 *
 * Están aquí y no en cada sección porque Brix y Criba capturan lo mismo —un
 * decimal tecleado a mano en una tablet— y de tres copias del redondeo saldrían
 * tres cifras distintas en el último decimal. Cada sección pone encima lo suyo:
 * cuántos caracteres admite el dato y con cuántos decimales se muestra.
 */

/**
 * Deja solo lo que puede formar un número: dígitos y un separador decimal.
 *
 * La coma se convierte en punto porque según el teclado sale una u otra, y así
 * lo guardado siempre se puede leer como número. El `maxLength` lo pone quien
 * llama: lo que pase de ahí es un error de tecleo, y cuánto es eso depende del
 * dato.
 */
export function sanitizeDecimalText(text: string, maxLength: number): string {
  const [integer, ...decimals] = text
    .replace(/,/g, ".")
    .replace(/[^0-9.]/g, "")
    .split(".");
  const joined =
    decimals.length > 0 ? `${integer}.${decimals.join("")}` : integer;

  return joined.slice(0, maxLength);
}

/**
 * Un valor tal como se captura (texto) y tal como se guarda (número).
 *
 * No rechaza nada, a propósito: lo vacío y lo que aún no es un número ("." a
 * medio escribir) cuentan como sin capturar, no como error. Tampoco hay mucho
 * que rechazar: `sanitizeDecimalText` ya impide teclear otra cosa que dígitos y
 * un separador. Lo que aporta es la salida tipada: lo que llegue al guardado
 * serán números, no strings.
 */
export const decimalTextSchema = z.string().transform((text): number | null => {
  if (text.trim() === "") return null;

  const value = Number(text);
  return Number.isFinite(value) ? value : null;
});

/** `null` si está vacío o aún no es un número ("." a medio escribir). */
export function parseDecimalText(text: string): number | null {
  return decimalTextSchema.parse(text);
}

/**
 * Solo para mostrar. Decimales fijos, y no "hasta dos", para que las cifras
 * queden alineadas en sus columnas.
 *
 * No basta con `toFixed`: redondea el número binario, no el decimal. 59.725 se
 * guarda como 59.72499… y saldría "59.72", distinto de la cuenta a mano o de
 * Excel. Llevarlo a la última cifra que se muestra y limpiar ese ruido antes de
 * redondear da 59.73.
 */
export function formatDecimal(value: number, fractionDigits: number): string {
  const factor = 10 ** fractionDigits;
  const scaled = Math.round(Number((value * factor).toFixed(6)));

  return (scaled / factor).toFixed(fractionDigits);
}
