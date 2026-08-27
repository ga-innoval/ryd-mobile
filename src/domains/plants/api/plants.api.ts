import { apiClient } from "@/lib/api-client";
import { PlantsResponse } from "./types";

export const plantsRequest = (since?: number) =>
  apiClient
    .get<PlantsResponse>("/api/ryd/plantaciones/", {
      params: since
        ? { updated_since: new Date(since).toISOString() }
        : undefined,
    })
    .then((r) => r.data);
