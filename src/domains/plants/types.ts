// Solo el tipo, así que la importación se borra al compilar y no hay ciclo con
// `evaluation-schema.ts`, que toma `EvalQuestion` de aquí.
import type { EvaluationSectionId } from "./lib/evaluation-schema";

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
 * Respuestas de **una** sección, indexadas por `id` de pregunta: en el
 * formulario cada sección tiene su propio record, bajo su `id`. Una clave puede
 * existir con valor `undefined`: es lo que deja deseleccionar una opción, y
 * por eso lo que cuenta es el valor, no la clave.
 */
export type EvalAnswers = Record<string, string | undefined>;

/**
 * Un corte de Brix tal como se captura: sus diez lecturas de refractómetro, en
 * orden.
 *
 * Texto y no número, por dos razones: así una lectura vacía no se confunde con
 * un cero, y lo que está a medio escribir ("18.") no se reformatea bajo el
 * dedo. Cómo se leen como números lo decide `lib/brix.ts`.
 */
export type BrixCorte = {
  readings: string[];
};

/**
 * Un calibre de la criba tal como se captura: el peso de todo lo que cayó en
 * ese calibre y el de una baya promedio.
 *
 * Texto y no número, por lo mismo que las lecturas de Brix, y aquí con más
 * motivo: 0 g significa un calibre sin fruta, así que un peso vacío no se puede
 * confundir con un cero. Cómo se leen como números lo decide `lib/criba.ts`.
 */
export type CribaCalibre = {
  total: string;
  average: string;
};

/**
 * Un corte de cosecha tal como se captura: cuándo se cortó, cuántos kilogramos
 * salieron y cuántos racimos.
 *
 * La fecha va en ISO (`2026-08-12`) y los dos pesos como texto, por lo mismo
 * que en Brix y Criba: un dato vacío no se confunde con un cero, y aquí 0 kg y
 * 0 racimos significan un corte sin fruta. Cómo se leen lo decide
 * `lib/rendimiento.ts`.
 */
export type RendimientoCorte = {
  fecha: string;
  kilogramos: string;
  racimos: string;
};

/**
 * De dónde sale una fotografía de evidencia. Cada origen tiene su propio botón
 * en la tira, así que capturar no pasa por preguntar primero.
 */
export type PhotoSource = "camera" | "library";

/**
 * Una de las tomas que se piden de cada tratamiento. El catálogo está en
 * `lib/photo-categories.ts`, y su `id` es la clave con la que se guardan las
 * fotografías de esa toma.
 */
export type PhotoCategory = {
  id: string;
  label: string;
};

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

/** Un tratamiento con lo que la tarjeta necesita saber de su captura. */
export interface TratamientoWithProgress extends TratamientoRecord {
  /** De 0 a 1, repartido entre las seis secciones (`evaluation-progress.ts`). */
  progress: number;
}

export interface Plant extends Omit<PlantWithTratamientos, "tratamientos"> {
  tratamientos: TratamientoWithProgress[];
  progress: number;
  /**
   * Los tratamientos con algún dato imposible (`evaluation-errors.ts`). Vacío es
   * una plantación sin errores, y por eso no hace falta un booleano aparte.
   */
  tratamientosWithError: string[];
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

/**
 * Una sección de la evaluación tal como se guarda, con su propio ciclo de
 * sincronización. La identidad es `(tratamientoId, seccion)`.
 *
 * `payload` sale de SQLite como texto, así que aquí es `unknown` y no el tipo
 * de la sección: quien lo lea decide con qué esquema validarlo. Al guardar sí
 * está tipado — ver `saveRespuesta`.
 */
export interface RespuestaRecord {
  tratamientoId: string;
  seccion: EvaluationSectionId;
  payload: unknown;
  syncStatus: SyncStatus;
  /** Cuándo se guardó en la tablet. Lo pone quien llama, en ISO. */
  updatedAtLocal: string;
  /** `null` mientras no haya llegado al servidor. */
  syncedAt: string | null;
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
