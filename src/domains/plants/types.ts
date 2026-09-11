/**
 * Una pregunta de selección única de la encuesta. La comparten los catálogos de
 * evaluación (`lib/evals-*.ts`), que solo se diferencian en su contenido.
 */
export type EvalQuestion = {
  id: string;
  label: string;
  options: { label: string; value: string }[];
  /**
   * Ocupa media fila en vez de una entera, para preguntas de pocas opciones
   * que a ancho completo dejan la fila medio vacía. Dos consecutivas se
   * emparejan solas: no hay que declarar el par en ningún sitio.
   */
  halfWidth?: boolean;
};

/**
 * Respuestas capturadas, indexadas por `id` de pregunta. Es **un solo record
 * para todas las secciones**, así que los ids tienen que ser únicos entre
 * catálogos. Una clave puede existir con valor `undefined`: es lo que deja
 * deseleccionar una opción, y por eso lo que cuenta es el valor, no la clave.
 */
export type EvalAnswers = Record<string, string | undefined>;

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
