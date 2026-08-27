import { create } from "zustand";
import { Plant } from "../types";
import { delay } from "@/lib/delay";
import { MOCK_PLANTS_DATA } from "../lib/mock-data";

interface PlantsDataState {
  data: Plant[];
  fetching: boolean;
  fetchLocalData: () => Promise<void>;
}

export const usePlantsDataStore = create<PlantsDataState>((set) => ({
  data: [],
  fetching: false,
  fetchLocalData: async () => {
    set({ fetching: true });
    await delay(500);
    // to do: reemplazar por lectura real de expo-sqlite
    set({ data: MOCK_PLANTS_DATA, fetching: false });
  },
}));
