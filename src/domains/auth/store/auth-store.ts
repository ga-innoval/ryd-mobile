import { create } from "zustand";
import { secureStorage, storage } from "../lib/storage";
import { loginRequest, refreshRequest } from "../api/auth.api";
import type { User } from "../types";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string>;
};

const getUserFullName = (firstName: string, lastName: string): string => {
  if (!firstName || !lastName) {
    return "";
  }
  return firstName + " " + lastName;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  init: async () => {
    const [access, refresh, user] = await Promise.all([
      secureStorage.getAccessToken(),
      secureStorage.getRefreshToken(),
      storage.getUser(),
    ]);
    set({
      accessToken: access,
      refreshToken: refresh,
      user,
      isAuthenticated: !!access,
      isLoading: false,
    });
  },

  login: async (username, password) => {
    const {
      token: { access, refresh },
      id,
      first_name,
      last_name,
      username: remoteUsername,
      initials,
    } = await loginRequest(username, password);
    const user = {
      id,
      fullName: getUserFullName(first_name, last_name),
      username: remoteUsername,
      initials,
    };

    await Promise.all([
      await secureStorage.setTokens(access, refresh),
      await storage.setUser(user),
    ]);
    set({
      accessToken: access,
      refreshToken: refresh,
      user,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    await Promise.all([
      await secureStorage.clearTokens(),
      await storage.clearUser(),
    ]);
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },

  refreshAccessToken: async () => {
    const { refreshToken } = get();
    if (!refreshToken) throw new Error("No refresh token found");

    const { access } = await refreshRequest(refreshToken);
    await secureStorage.setTokens(access, refreshToken);
    set({ accessToken: access });
    return access;
  },
}));
