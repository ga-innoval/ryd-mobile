import axios from "axios";
import { useAuthStore } from "@/domains/auth/store/auth-store";
import { env } from "./env";

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Adds current access token to each outcoming request
apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// If request is 401, tries to refresh once. If fails, logs out

type pendingQueueItem = {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}[];

let isRefreshing = false;
let pendingQueue: pendingQueueItem = [];

function resolvePendingQueue(token: string) {
  pendingQueue.forEach(({ resolve }) => resolve(token));
  pendingQueue = [];
}
function rejectPendingQueue(err: unknown) {
  pendingQueue.forEach(({ reject }) => reject(err));
  pendingQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Ongoing refresh. Queues request and waits for new token
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const newAccessToken = await useAuthStore.getState().refreshAccessToken();
      resolvePendingQueue(newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      rejectPendingQueue(refreshError);
      await useAuthStore.getState().logout(); // logs out since refresh failed
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
