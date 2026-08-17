import { create } from "zustand";
import { Evaluacion } from "../types";
import { delay } from "@/lib/delay";
import { MOCK_EVALS_DATA } from "../lib/mock-data";

interface EvalsDataState {
  data: Evaluacion[];
  fetching: boolean;
  fetchLocalData: () => Promise<void>;
}

export const useEvalsDataStore = create<EvalsDataState>((set) => ({
  data: [],
  fetching: false,
  fetchLocalData: async () => {
    set({ fetching: true });
    await delay(500);
    // to do: reemplazar por lectura real de expo-sqlite
    set({ data: MOCK_EVALS_DATA, fetching: false });
  },
}));
