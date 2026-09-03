import { TratamientoRecord } from "@/domains/plants/types";

export const buildTratamiento = (
  overrides: Partial<TratamientoRecord> = {},
): TratamientoRecord => ({
  id: "trat-1",
  plantId: "eval-1",
  name: "Trat 1",
  description: "Tratamiento de referencia",
  temporada: 2026,
  isActive: true,
  ...overrides,
});
