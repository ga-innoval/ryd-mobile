import { authClient } from "@/lib/api-client";
import { TokenPair } from "../types";

export const loginRequest = (username: string, password: string) =>
  authClient
    .post<TokenPair>("/api/token/", { username, password })
    .then((r) => r.data);

export const refreshRequest = (refresh: string) =>
  authClient
    .post<{ access: string }>("/api/token/refresh/", { refresh })
    .then((r) => r.data);
