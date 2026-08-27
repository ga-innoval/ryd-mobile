export enum SyncStatus {
  pending = "pending",
  synced = "synced",
  syncing = "syncing",
  error = "error",
  rejected_closed = "rejected_closed",
  unsynced = "unsynced",
}

export interface Plant {
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

export type MatchableField =
  "name" | "campo" | "cuadro" | "programa" | "patron" | "anio";

export interface FieldMatch {
  field: MatchableField;
  index: number;
  length: number;
}

export interface PlantWithMatch {
  plantItem: Plant;
  match?: FieldMatch;
}

export enum DownloadStatus {
  pending = "pending",
  downloaded = "downloaded",
  downloading = "downloading",
  error = "error",
  notDownloaded = "notDownloaded",
}

export enum FilterValues {
  todas = "todas",
  sinIniciar = "sin iniciar",
  iniciadas = "iniciadas",
  pendientes = "pendientes",
}
