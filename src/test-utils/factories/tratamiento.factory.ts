import type { TratamientoWithProgress } from "@/domains/plants/types";

/**
 * Trae `progress` porque es lo que ve la tarjeta; donde haga falta la fila de
 * SQLite pelada (`TratamientoRecord`), sobra un campo y no molesta.
 */
export const buildTratamiento = (
  overrides: Partial<TratamientoWithProgress> = {},
): TratamientoWithProgress => ({
  id: "trat-1",
  plantId: "eval-1",
  name: "Trat 1",
  description: "Tratamiento de referencia",
  temporada: 2026,
  isActive: true,
  progress: 0,
  ...overrides,
});
