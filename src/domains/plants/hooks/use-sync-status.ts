import { SyncStatus } from "../types";
import { useSyncStore } from "../store/sync-store";

export function useSyncStatus() {
  const { isSyncing, lastSyncedAt, lastSyncError, triggerSync } =
    useSyncStore();

  // TODO: cuando exista la tabla `respuestas`, este conteo sale de SQLite
  // (respuestas con sync_status = 'pending'), vía su propia query.
  const pendingCount = 0;

  const getStatus = (): SyncStatus => {
    if (isSyncing) return SyncStatus.syncing;
    if (lastSyncError) return SyncStatus.error;
    if (pendingCount > 0) return SyncStatus.pending;
    if (!lastSyncedAt) return SyncStatus.unsynced;
    return SyncStatus.synced;
  };

  return { status: getStatus(), pendingCount, lastSyncedAt, triggerSync };
}
