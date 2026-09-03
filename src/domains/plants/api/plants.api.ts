import { apiClient } from "@/lib/api-client";
import { PendingPlantsResponse, PlantsResponse } from "./types";

export const plantsRequest = (since?: number) =>
  apiClient
    .get<PlantsResponse>("/api/ryd/plantaciones/", {
      params: since
        ? { updated_since: new Date(since).toISOString() }
        : undefined,
    })
    .then((r) => r.data);

export const pendingPlantsRequest = (since: number) =>
  apiClient
    .get<PendingPlantsResponse>("/api/ryd/plantaciones/pendientes/", {
      params: { updated_since: new Date(since).toISOString() },
    })
    .then((r) => r.data);
