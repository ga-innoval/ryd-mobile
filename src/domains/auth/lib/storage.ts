import * as SecureStorage from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "../types";
import z from "zod";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

// Solo datos sensibles (cifrado)
export const secureStorage = {
  getAccessToken: () => SecureStorage.getItemAsync(ACCESS_TOKEN_KEY),
  getRefreshToken: () => SecureStorage.getItemAsync(REFRESH_TOKEN_KEY),
  setTokens: async (access: string, refresh: string) => {
    await SecureStorage.setItemAsync(ACCESS_TOKEN_KEY, access);
    await SecureStorage.setItemAsync(REFRESH_TOKEN_KEY, refresh);
  },
  clearTokens: async () => {
    await SecureStorage.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStorage.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};

const USER_KEY = "auth_user";

const userSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  username: z.string(),
  initials: z.string(),
});

// Solo datos no sensibles
export const storage = {
  setUser: async (user: User) => {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  getUser: async (): Promise<User | null> => {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return userSchema.parse(JSON.parse(raw));
    } catch (error) {
      await AsyncStorage.removeItem(USER_KEY);
      return null;
    }
  },
  clearUser: async () => {
    await AsyncStorage.removeItem(USER_KEY);
  },
};
