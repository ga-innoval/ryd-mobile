import { create } from "zustand";
import { persist } from "zustand/middleware";
import { userScopedJSONStorage } from "@/lib/user-storage";

type DownloadStore = {
  lastDownloadAt: number | null;
  pendingCount: number;
  setLastDownloadAt: (timestamp: number) => void;
  setPendingCount: (count: number) => void;
};

export const useDownloadStore = create<DownloadStore>()(
  persist(
    (set) => ({
      lastDownloadAt: null,
      pendingCount: 0,
      setLastDownloadAt: (timestamp) =>
        set({ lastDownloadAt: timestamp, pendingCount: 0 }),
      setPendingCount: (count) => set({ pendingCount: count }),
    }),
    {
      name: "download-store",
      storage: userScopedJSONStorage(),
    },
  ),
);
