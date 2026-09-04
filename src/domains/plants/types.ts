export enum SyncStatus {
  pending = "pending",
  synced = "synced",
  syncing = "syncing",
  error = "error",
  rejected_closed = "rejected_closed",
  unsynced = "unsynced",
}

export interface PlantWithTratamientos extends PlantRecord {
  tratamientos: TratamientoRecord[];
}

export interface Plant extends PlantWithTratamientos {
  progress: number;
}

export type MatchableField =
  "name" | "campo" | "cuadro" | "programa" | "portainjerto" | "anio";

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

export type OrderByField = MatchableField;

export type OrderDirection = "asc" | "desc";

export enum FilterValues {
  todas = "todas",
  sinIniciar = "sin iniciar",
  iniciadas = "iniciadas",
  pendientes = "pendientes",
}

export interface TratamientoRecord {
  id: string;
  plantId: string;
  name: string;
  description: string;
  temporada: number;
  // Refleja `is_active` de la fila remota `EvaluacionTratamiento`, no el del
  // catálogo `Tratamiento`. Decide si la fila se conserva o se poda.
  isActive: boolean;
}

export interface PlantSyncEntry {
  plant: PlantRecord;
  tratamientos: TratamientoRecord[];
  // `is_active` de la plantación remota: decide si se conserva o se borra.
  isActive: boolean;
}

export interface PlantRecord {
  id: string;
  name: string;
  campo: string;
  cuadro: string;
  programa: string;
  portainjerto: string;
  anio: number;
  syncStatus: SyncStatus;
}
