import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

type DownloadStore = {
  lastDownloadAt: number | null;
  setLastDownloadAt: (timestamp: number) => void;
};

export const useDownloadStore = create<DownloadStore>()(
  persist(
    (set) => ({
      lastDownloadAt: null,
      setLastDownloadAt: (timestamp) => set({ lastDownloadAt: timestamp }),
    }),
    {
      name: "download-store",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
