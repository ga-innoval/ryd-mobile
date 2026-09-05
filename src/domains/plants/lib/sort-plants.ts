import type { OrderByField, OrderDirection, Plant } from "../types";
import { normalizeText } from "./normalize-text";

// Trocea en rachas de dígitos y de no-dígitos: "10A" → ["10", "a"].
const chunks = (value: string) => normalizeText(value).match(/\d+|\D+/g) ?? [];

const isNumeric = (chunk: string) => /^\d/.test(chunk);

/**
 * Orden natural: los tramos numéricos se comparan como números, no como texto.
 *
 * Sin esto, los cuadros salen "10A, 1A, 2A": tras el `1` común se compara
 * `'0'` (48) contra `'A'` (65) y gana el `10A`. Se aplica a todos los campos
 * de texto, no solo a Cuadro — "Programa 10" tenía el mismo problema.
 */
const compareText = (a: string, b: string) => {
  const left = chunks(a);
  const right = chunks(b);
  const shared = Math.min(left.length, right.length);

  for (let i = 0; i < shared; i++) {
    if (isNumeric(left[i]) && isNumeric(right[i])) {
      const diff = Number(left[i]) - Number(right[i]);
      // Iguales como número ("01" y "1"): decide el tramo siguiente.
      if (diff !== 0) return diff;
      continue;
    }

    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }

  // Uno es prefijo del otro: gana el más corto ("1" antes que "1A").
  return left.length - right.length;
};

const compareValues = (a: string | number, b: string | number) => {
  // `anio` es numérico. Compararlo como texto funcionaría por accidente
  // mientras todos los años tengan cuatro dígitos; mejor no depender de eso.
  if (typeof a === "number" && typeof b === "number") return a - b;

  return compareText(String(a), String(b));
};

/**
 * El orden se hace aquí y no con un `ORDER BY` porque `expo-sqlite` no trae
 * ICU: ordenaría por bytes y dejaría `Ñ`, `Á` e `Í` después de la Z.
 *
 * `Array.prototype.sort` es estable desde ES2019, así que los empates
 * conservan el orden que trae el repositorio (`ORDER BY name ASC`). Ese es el
 * desempate determinista, y el motivo para no quitar ese ORDER BY.
 */
export const sortPlants = (
  plants: Plant[],
  field: OrderByField,
  direction: OrderDirection = "asc",
): Plant[] => {
  const sign = direction === "asc" ? 1 : -1;

  // `sort` muta: se copia porque el array de entrada viene memoizado aguas
  // arriba y mutarlo rompería esa memoización.
  return [...plants].sort((a, b) => sign * compareValues(a[field], b[field]));
};
