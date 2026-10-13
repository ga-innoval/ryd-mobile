import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Cuándo fue la última sincronización. **Nada más.**
 *
 * Antes este store llevaba también `isSyncing`, `lastSyncError` y un
 * `triggerSync` con un `delay(3_000)` de mentira. El ciclo de vida se fue a una
 * mutation de TanStack Query —legible desde cualquier parte con
 * `useIsMutating`—, que es el patrón de la descarga y el que CLAUDE.md pedía no
 * volver a copiar de aquí.
 *
 * Persistido, al revés que antes: la pregunta que contesta —«¿cuándo mandé esto
 * por última vez?»— tiene que sobrevivir a cerrar la app, que en campo pasa
 * todos los días.
 *
 * **Es el reloj del dispositivo**, no el del servidor, al revés que el watermark
 * de la descarga: la respuesta del lote no trae `server_time`, y esto es
 * contabilidad local que nadie compara entre tablets.
 */
type SyncStore = {
  lastSyncedAt: number | null;
  setLastSyncedAt: (timestamp: number) => void;
};

export const useSyncStore = create<SyncStore>()(
  persist(
    (set) => ({
      lastSyncedAt: null,
      setLastSyncedAt: (timestamp) => set({ lastSyncedAt: timestamp }),
    }),
    {
      name: "sync-store",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
