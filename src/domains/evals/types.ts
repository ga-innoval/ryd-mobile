export enum SyncStatus {
  PEN = "PEN",
  SYNC = "SYNC",
}

export interface Evaluacion {
  id: string;
  name: string;
  campo: string;
  cuadro: string;
  programa: string;
  patron: string;
  anio: string | number;
  tratamientos: { name: string }[];
  progress: number;
  syncStatus: SyncStatus;
}
