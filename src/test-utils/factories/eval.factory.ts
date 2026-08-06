import { SyncStatus } from "@/domains/evals/types";

export const buildEvaluacion = (overrides = {}) => ({
  id: "eval-1",
  name: "1004-Freedom",
  campo: "Pozo Manuel",
  cuadro: "1A",
  programa: "Temprano",
  patron: "Freedom",
  anio: 2026,
  tratamientos: [{ name: "Trat 1" }, { name: "Trat 2" }, { name: "Trat 3" }],
  progress: 0.1,
  syncStatus: SyncStatus.PEN,
  ...overrides,
});
