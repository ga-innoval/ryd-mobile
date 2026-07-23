import { create } from "zustand";
import { secureStorage } from "../lib/secure-storage";
import { loginRequest, refreshRequest } from "../api/auth.api";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  isAuthenticated: false,

  init: async () => {
    const [access, refresh] = await Promise.all([
      secureStorage.getAccessToken(),
      secureStorage.getRefreshToken(),
    ]);
    set({
      accessToken: access,
      refreshToken: refresh,
      isAuthenticated: !!access,
      isLoading: false,
    });
  },

  login: async (username, password) => {
    const {
      token: { access, refresh },
    } = await loginRequest(username, password);
    await secureStorage.setTokens(access, refresh);
    set({ accessToken: access, refreshToken: refresh, isAuthenticated: true });
  },

  logout: async () => {
    await secureStorage.clearTokens();
    set({ accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  refreshAccessToken: async () => {
    const { refreshToken } = get();
    if (!refreshToken) throw new Error("No hay refresh token");

    const { access } = await refreshRequest(refreshToken);
    await secureStorage.setTokens(access, refreshToken);
    set({ accessToken: access });
    return access;
  },
}));
