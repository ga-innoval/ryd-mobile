import { delay } from "@/lib/delay";
import { create } from "zustand";

type SyncState = {
  isSyncing: boolean;
  lastSyncedAt: number | null;
  lastSyncError: string | null;
  triggerSync: () => Promise<void>;
};

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  lastSyncedAt: null,
  lastSyncError: null,

  triggerSync: async () => {
    set({ isSyncing: true, lastSyncError: null });
    try {
      //to do: pull y push real de respuestas
      await delay(3_000);
      set({ isSyncing: false, lastSyncedAt: Date.now() });
    } catch (err) {
      set({ isSyncing: false, lastSyncError: (err as Error).message });
    }
  },
}));
