import { SyncStatus } from "../types";
import { useSyncStore } from "../store/sync-store";
import { MOCK_PLANTS_DATA } from "../lib/mock-data";

export function useSyncStatus() {
  const { isSyncing, lastSyncedAt, lastSyncError, triggerSync } =
    useSyncStore();

  const pendingCount = MOCK_PLANTS_DATA.filter(
    (item) => item.syncStatus === SyncStatus.pending,
  ).length;

  const getStatus = (): SyncStatus => {
    if (isSyncing) return SyncStatus.syncing;
    if (lastSyncError) return SyncStatus.error;
    if (pendingCount > 0) return SyncStatus.pending;
    if (!lastSyncedAt) return SyncStatus.unsynced;
    return SyncStatus.synced;
  };

  return { status: getStatus(), pendingCount, lastSyncedAt, triggerSync };
}
