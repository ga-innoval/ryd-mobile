import { loginRequest } from "../../api/auth.api";
import { useAuthStore } from "../auth-store";

jest.mock("../../lib/secure-storage");
jest.mock("../../api/auth.api");

test("login() guarda tokens y actualiza isAuthenticated", async () => {
  (loginRequest as jest.Mock).mockResolvedValue({
    token: {
      access: "accessToken",
      refresh: "refreshToken",
    },
  });
  await useAuthStore.getState().login("user", "pass");
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
});

test("logout() limpia el estado completamente", async () => {
  useAuthStore.setState({ accessToken: "accessToken", isAuthenticated: true });
  await useAuthStore.getState().logout();
  expect(useAuthStore.getState().accessToken).toBeNull();
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
});
