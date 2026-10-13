import { TERMINAL_REJECTIONS } from "./sync-reconcile";

/** Qué hacer con la fila de una fotografía después de intentar subirla. */
export type UploadOutcome =
  /** Llegó: a marcar `synced`. */
  | { kind: "ok" }
  /**
   * El archivo ya no está en disco. Cuenta como fallo y **no lanza**: lo normal
   * es que el evaluador la haya borrado mientras subía, y una excepción ahí
   * tumbaría el resto de la tanda.
   */
  | { kind: "missing" }
  /** Rechazada sin vuelta —la encuesta está cerrada—: a marcar `rejected_closed`. */
  | { kind: "rejected" }
  /** Se queda pendiente, y el siguiente envío la reintenta. */
  | { kind: "failed" };

/**
 * **`file.upload()` resuelve también con un 4xx o un 5xx**, no solo con un 2xx —
 * lo dice su typing: «for any completed response, including non-2xx status
 * codes»—. Así que un `await` que no revienta **no significa que el servidor
 * aceptara la foto**, y sin mirar el `status` a mano cada fotografía se marcaría
 * como enviada contra un 500.
 *
 * Es el fallo más fácil de cometer en todo el camino de las fotografías, y por
 * eso el veredicto vive aquí, en una función pura con test, en vez de en un `if`
 * dentro del bucle de subida.
 *
 * El 409 con `encuesta_cerrada` es una adición del servidor sobre el contrato,
 * que solo definía `code` para el lote. Se trata igual que allí: terminal, para
 * que la foto salga de la cola en vez de reintentarse en cada envío.
 */
export function uploadOutcome(
  response: { status: number; body: string } | null,
): UploadOutcome {
  if (response === null) return { kind: "missing" };

  if (response.status >= 200 && response.status < 300) return { kind: "ok" };

  if (TERMINAL_REJECTIONS.some((code) => response.body.includes(code))) {
    return { kind: "rejected" };
  }

  return { kind: "failed" };
}
