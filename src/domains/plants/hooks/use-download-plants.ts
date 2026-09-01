import { useSQLiteContext } from "expo-sqlite";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { plantsRequest } from "../api/plants.api";
import { mapRemotePlant } from "../lib/map-remote-plant";
import { PLANTS_QUERY_KEY } from "./use-plants";
import { useDownloadStore } from "../store/download-store";
import { upsertPlantsBatch } from "../lib/db/plants.repository";
import { toast } from "@/lib/toast";

export function useDownloadPlants() {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();
  const lastDownloadAt = useDownloadStore((s) => s.lastDownloadAt);
  const setLastDownloadAt = useDownloadStore((s) => s.setLastDownloadAt);

  return useMutation({
    mutationFn: async () => {
      const { server_time, results } = await plantsRequest(
        lastDownloadAt ?? undefined,
      );
      const plants = results.map(mapRemotePlant);

      if (plants.length > 0) {
        await upsertPlantsBatch(db, plants);
      }

      return { count: plants.length, serverTime: server_time };
    },
    onSuccess: ({ count, serverTime }) => {
      queryClient.invalidateQueries({ queryKey: PLANTS_QUERY_KEY });
      setLastDownloadAt(new Date(serverTime).getTime());
      toast.success({
        title: "Descarga completa",
        description: `Se ${count === 1 ? "ha" : "han"} actualizado ${count} ${count === 1 ? "plantacion" : "plantaciones"}.`,
      });
    },
    onError: (error) => {
      toast.error({
        title: "Error de descarga",
        description: error.message,
      });
    },
  });
}
