import { useSQLiteContext } from "expo-sqlite";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { plantsRequest } from "../api/plants.api";
import { mapRemotePlantEntry } from "../lib/map-remote-plant-entry";
import { PLANTS_QUERY_KEY } from "./use-plants";
import { useDownloadStore } from "../store/download-store";
import { syncPlantsBatch } from "../lib/db/plants.repository";
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

      if (entries.length > 0) {
        await syncPlantsBatch(db, entries);
      }

      return { count: entries.length, serverTime: server_time };
    },
    onSuccess: ({ count, serverTime }) => {
      queryClient.invalidateQueries({ queryKey: PLANTS_QUERY_KEY });
      setLastDownloadAt(new Date(serverTime).getTime());
      haptics.success();
      toast.success({
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
