import { authClient } from "@/lib/auth-client";
import { LoginResponse } from "../types";

export const loginRequest = (username: string, password: string) =>
  authClient
    .post<LoginResponse>("/api/signin/", { username, password })
    .then((r) => r.data);

export const refreshRequest = (refresh: string) =>
  authClient
    .post<{ access: string }>("/api/token/refresh/", { refresh })
    .then((r) => r.data);
