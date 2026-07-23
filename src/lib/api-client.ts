import axios from "axios";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://api.gainnoval.com/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});
