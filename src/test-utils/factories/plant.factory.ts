import { SyncStatus } from "@/domains/plants/types";

export const buildPlant = (overrides = {}) => ({
  id: "eval-1",
  name: "1004-Freedom",
  campo: "Pozo Manuel",
  cuadro: "1A",
  programa: "Temprano",
  portainjerto: "Freedom",
  anio: 2026,
  tratamientos: [{ name: "Trat 1" }, { name: "Trat 2" }, { name: "Trat 3" }],
  progress: 0.1,
  syncStatus: SyncStatus.pending,
  ...overrides,
});
