import { loginRequest, refreshRequest } from "../../api/auth.api";
import { secureStorage, storage } from "../../lib/storage";
import { useAuthStore } from "../auth-store";

jest.mock("../../lib/storage");
jest.mock("../../api/auth.api");

afterEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    isLoading: false,
    isAuthenticated: false,
  });
});

describe("login()", () => {
  test("stores tokens in secureStorage and updates auth state", async () => {
    (loginRequest as jest.Mock).mockResolvedValue({
      token: {
        access: "access-token",
        refresh: "refresh-token",
      },
      username: "user-name",
    });

    await useAuthStore.getState().login("user", "password");

    expect(secureStorage.setTokens).toHaveBeenCalledWith(
      "access-token",
      "refresh-token",
    );
    expect(secureStorage.setTokens).toHaveBeenCalledTimes(1);

    expect(useAuthStore.getState().accessToken).toBe("access-token");
    expect(useAuthStore.getState().refreshToken).toBe("refresh-token");
    expect(useAuthStore.getState().user?.username).toBe("user-name");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  test("won't store token or update state if loginRequest fails", async () => {
    (loginRequest as jest.Mock).mockRejectedValue(
      new Error("invalid credentials"),
    );

    await expect(
      useAuthStore.getState().login("user", "wrong-password"),
    ).rejects.toThrow();

    expect(secureStorage.setTokens).not.toHaveBeenCalled();
    expect(storage.setUser).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe("logout()", () => {
  test("clears secureStorage and auth state", async () => {
    useAuthStore.setState({
      accessToken: "old-token",
      refreshToken: "old-refresh",
      isAuthenticated: true,
      user: {
        id: "c42b40e9-a770-4b34-b978-115c6547b751",
        fullName: "full user name",
        username: "user-name",
        initials: "u",
      },
    });

    await useAuthStore.getState().logout();

    expect(secureStorage.clearTokens).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe("init()", () => {
  test("restores session if tokens are found in secureStorage", async () => {
    (secureStorage.getAccessToken as jest.Mock).mockResolvedValue(
      "stored-access",
    );
    (secureStorage.getRefreshToken as jest.Mock).mockResolvedValue(
      "stored-refresh",
    );
    (storage.getUser as jest.Mock).mockResolvedValue({ username: "user-name" });

    await useAuthStore.getState().init();

    expect(useAuthStore.getState().accessToken).toBe("stored-access");
    expect(useAuthStore.getState().refreshToken).toBe("stored-refresh");
    expect(useAuthStore.getState().user?.username).toBe("user-name");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  test("won't update isAuthenticated (false) if no tokens found in secureStorage", async () => {
    (secureStorage.getAccessToken as jest.Mock).mockResolvedValue(null);
    (secureStorage.getRefreshToken as jest.Mock).mockResolvedValue(null);
    (storage.getUser as jest.Mock).mockResolvedValue(null);

    await useAuthStore.getState().init();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

describe("refreshAccessToken()", () => {
  test("updates access token, keeping refresh token the same", async () => {
    useAuthStore.setState({ refreshToken: "valid-refresh" });
    (refreshRequest as jest.Mock).mockResolvedValue({ access: "new-access" });

    const resultado = await useAuthStore.getState().refreshAccessToken();

    expect(resultado).toBe("new-access");
    expect(secureStorage.setTokens).toHaveBeenCalledWith(
      "new-access",
      "valid-refresh",
    );
    expect(useAuthStore.getState().accessToken).toBe("new-access");
  });

  test("throws error if no refresh token in state", async () => {
    useAuthStore.setState({ refreshToken: null });

    await expect(useAuthStore.getState().refreshAccessToken()).rejects.toThrow(
      "No refresh token found",
    );

    expect(refreshRequest).not.toHaveBeenCalled();
  });
});
