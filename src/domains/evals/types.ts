export enum SyncStatus {
  pending = "pending",
  synced = "synced",
  syncing = "syncing",
  error = "error",
  rejected_closed = "rejected_closed",
  unsynced = "unsynced",
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

export type MatchableField =
  "name" | "campo" | "cuadro" | "programa" | "patron" | "anio";

export interface FieldMatch {
  field: MatchableField;
  index: number;
  length: number;
}

export interface EvaluacionWithMatch {
  evalItem: Evaluacion;
  match?: FieldMatch;
}

export enum DownloadStatus {
  pending = "pending",
  downloaded = "downloaded",
  downloading = "downloading",
  error = "error",
  notDownloaded = "notDownloaded",
}
