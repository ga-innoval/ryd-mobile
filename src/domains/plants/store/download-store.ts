import { delay } from "@/lib/delay";
import { create } from "zustand";
import { usePlantsDataStore } from "./data-store";

type TriggerDownloadOptions = {
  onSuccess?: () => void;
  onError?: (error: string) => void;
};

type DownloadState = {
  isDownloading: boolean;
  lastDownloadAt: number | null;
  lastDownloadError: string | null;
  triggerDownload: (options?: TriggerDownloadOptions) => Promise<void>;
};

export const useDownloadStore = create<DownloadState>((set) => ({
  isDownloading: false,
  lastDownloadAt: null,
  lastDownloadError: null,

  triggerDownload: async (options) => {
    set({ isDownloading: true, lastDownloadError: null });
    try {
      //to do: descarga real de encuestas
      await delay(3_000);
      await usePlantsDataStore.getState().fetchLocalData();

      set({ isDownloading: false, lastDownloadAt: Date.now() });
      options?.onSuccess?.();
    } catch (err) {
      const message = (err as Error).message;
      set({ isDownloading: false, lastDownloadError: message });
      options?.onError?.(message);
    }
  },
}));
