import { useSQLiteContext } from "expo-sqlite";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { plantsRequest } from "../api/plants.api";
import { mapRemotePlant } from "../lib/map-remote-plant";
import { PLANTS_QUERY_KEY } from "./use-plants";
import { useDownloadStore } from "../store/download-store";
import { upsertPlantsBatch } from "../lib/db/plants.repository";

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
    onSuccess: ({ serverTime }) => {
      queryClient.invalidateQueries({ queryKey: PLANTS_QUERY_KEY });
      setLastDownloadAt(new Date(serverTime).getTime());
    },
    onError: (err) => console.log(err),
  });
}
