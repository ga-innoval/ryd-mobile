import { SyncStatus } from "../types";

type SyncStatusInput = {
  isSyncing: boolean;
  hasError: boolean;
  /** Plantaciones con algo capturado sin mandar. */
  pendingCount: number;
  lastSyncedAt: number | null;
};

/**
 * El estado del bloque de sincronización de la pantalla principal.
 *
 * Calco de `getDownloadStatus`, y a propósito: son los dos sentidos de lo mismo
 * y leerlos distinto haría que la cabecera contara dos historias.
 *
 * **`rejected_closed` no sale de aquí todavía.** `SyncBlock` tiene su estado
 * pintado, pero el conteo que llega es el de lo pendiente, y lo rechazado no
 * está pendiente — reintentarlo no abre la encuesta. Hoy un rechazo se ve en la
 * pantalla de esa captura y en el aviso del envío que lo produjo; para que
 * también se viera aquí haría falta un conteo propio. Queda dicho para que nadie
 * lo dé por cubierto.
 */
export const getSyncStatus = ({
  isSyncing,
  hasError,
  pendingCount,
  lastSyncedAt,
}: SyncStatusInput): SyncStatus => {
  if (isSyncing) return SyncStatus.syncing;
  if (hasError) return SyncStatus.error;
  if (pendingCount > 0) return SyncStatus.pending;
  if (!lastSyncedAt) return SyncStatus.unsynced;
  return SyncStatus.synced;
};
