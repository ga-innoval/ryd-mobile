import { setItemAsync, getItemAsync, deleteItemAsync } from "expo-secure-store";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

export const secureStorage = {
  getAccessToken: () => getItemAsync(ACCESS_TOKEN_KEY),
  getRefreshToken: () => getItemAsync(REFRESH_TOKEN_KEY),
  setTokens: async (access: string, refresh: string) => {
    await setItemAsync(ACCESS_TOKEN_KEY, access);
    await setItemAsync(REFRESH_TOKEN_KEY, refresh);
  },
  clearTokens: async () => {
    await deleteItemAsync(ACCESS_TOKEN_KEY);
    await deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
