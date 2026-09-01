import { useSQLiteContext } from "expo-sqlite";
import { useQuery } from "@tanstack/react-query";
import { getAllPlants } from "../lib/db/plants.repository";

export const PLANTS_QUERY_KEY = ["plants"] as const;

export function usePlants() {
  const db = useSQLiteContext();

  return useQuery({
    queryKey: PLANTS_QUERY_KEY,
    queryFn: () => getAllPlants(db),
  });
}
