import type { OrderByField, OrderDirection, Plant } from "../types";
import { normalizeText } from "./normalize-text";

const compareValues = (a: string | number, b: string | number) => {
  if (typeof a === "number" && typeof b === "number") return a - b;

  const left = normalizeText(String(a));
  const right = normalizeText(String(b));

  return left < right ? -1 : left > right ? 1 : 0;
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
