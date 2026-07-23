import { apiClient } from "@/lib/api-client";
import { TokenPair } from "../types";

export const loginRequest = (username: string, password: string) =>
  apiClient
    .post<TokenPair>("/api/token/", { username, password })
    .then((r) => r.data);

export const refreshRequest = (refresh: string) =>
  apiClient
    .post<{ access: string }>("/api/token/refresh/", { refresh })
    .then((r) => r.data);
