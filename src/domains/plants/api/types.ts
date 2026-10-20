export interface RemoteTrat {
  id: string;
  name: string;
  description: string;
  temporada: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RemotePlant {
  id: string;
  variedad: RemoteVariedad;
  portainjerto: string;
  campo: string;
  campo_id: number;
  cuadro: string;
  anio: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tratamientos: RemoteTrat[];
}

export interface PlantsResponse {
  server_time: string;
  results: RemotePlant[];
}

export interface PendingPlantsResponse {
  count: number;
}

interface RemoteVariedad {
  id: string;
  name: string;
  code: string;
  color: string;
  programa: RemotePrograma;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RemotePrograma {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ───────────────────────────── push de capturas ─────────────────────────────

/**
 * Una sección de tratamiento camino del servidor
 * (`docs/contrato-respuestas.md`).
 *
 * `evaluacion_id` es el `id` de la fila `EvaluacionTratamiento`, que es lo que
 * el pull guarda como `tratamientos.id` — no el del catálogo `Tratamiento`.
 * `capturado_en` dice cuándo se capturó en campo, que puede ser días antes de
 * que hubiera señal; no sustituye al `updated_at` del servidor.
 */
export interface WireRespuesta {
  evaluacion_id: string;
  seccion: string;
  capturado_en: string;
  payload: Record<string, unknown>;
}

/** Lo mismo para post-cosecha, con la llave de tres partes. */
export interface WirePostcosechaRespuesta {
  plantacion_id: string;
  eval_id: string;
  seccion: string;
  capturado_en: string;
  payload: Record<string, unknown>;
}

/**
 * El veredicto de **un** registro. El lote nunca es todo-o-nada.
 *
 * Los campos de llave llegan como `unknown` a propósito: el servidor hace eco
 * de **lo que se mandó, crudo**, para que un registro que no pasó su validación
 * se pueda emparejar igual. Quien los use los normaliza antes de comparar.
 *
 * `code` solo viene en los rechazos terminales. Un `error` sin `code` es un
 * fallo que puede dejar de pasar —un dueño que todavía no se había
 * descargado—, así que se reintenta.
 */
export interface BatchResult {
  evaluacion_id?: unknown;
  plantacion_id?: unknown;
  eval_id?: unknown;
  seccion?: unknown;
  status: "ok" | "error";
  code?: string;
}

export interface BatchResponse {
  results: BatchResult[];
}
