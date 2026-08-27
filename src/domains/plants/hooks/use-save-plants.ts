import { useSQLiteContext } from "expo-sqlite";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Plant } from "../types";
import { upsertPlantsBatch } from "../lib/db/plants.repository";

export function useSavePlants() {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (plants: Plant[]) => upsertPlantsBatch(db, plants),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plantaciones"] });
    },
  });
}
