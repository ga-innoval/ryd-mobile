import { useSQLiteContext } from "expo-sqlite";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { plantsRequest } from "../api/plants.api";
import { mapRemotePlantEntry } from "../lib/map-remote-plant-entry";
import { PLANTS_QUERY_KEY } from "./use-plants";
import { useDownloadStore } from "../store/download-store";
import { syncPlantsBatch } from "../lib/db/plants.repository";
import { sweepOrphanPhotos } from "./use-respuesta-fotos";
import { formatDownloadSummary } from "../lib/format-download-summary";
import { toast } from "@/lib/toast";
import { haptics } from "@/lib/haptics";

// Permite que cualquier consumidor lea el estado de la descarga desde la
// cache (`useIsMutating`) en vez de depender de su propio observer.
export const PLANTS_DOWNLOAD_MUTATION_KEY = ["plants", "download"];

export function usePlantsMutation() {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();
  const lastDownloadAt = useDownloadStore((s) => s.lastDownloadAt);
  const setLastDownloadAt = useDownloadStore((s) => s.setLastDownloadAt);

  return useMutation({
    mutationKey: PLANTS_DOWNLOAD_MUTATION_KEY,
    mutationFn: async () => {
      const { server_time, results } = await plantsRequest(
        lastDownloadAt ?? undefined,
      );
      const entries = results.map(mapRemotePlantEntry);

      // El conteo sale del sync y no de `entries.length`: las plantaciones sin
      // tratamientos usables no se almacenan, así que anunciarlas como
      // actualizadas sería mentir.
      const count = entries.length > 0 ? await syncPlantsBatch(db, entries) : 0;

      // Después de la descarga y fuera de su transacción: la poda borra filas
      // por CASCADE pero SQLite no toca el disco, así que aquí es donde se
      // recupera el espacio de las fotografías que ya no tienen dueño.
      //
      // Con su propio `catch`: no recuperar espacio no puede convertir una
      // descarga correcta en un error.
      await sweepOrphanPhotos(db).catch(() => 0);

      return { count, serverTime: server_time };
    },
    onSuccess: ({ count, serverTime }) => {
      queryClient.invalidateQueries({ queryKey: PLANTS_QUERY_KEY });
      setLastDownloadAt(new Date(serverTime).getTime());
      haptics.success();
      toast.error({
        title: "Descarga completa",
        description: formatDownloadSummary(count),
      });
    },
    onError: (error) => {
      haptics.error();
      toast.error({
        title: "Error de descarga",
        description: error.message,
      });
    },
  });
}
