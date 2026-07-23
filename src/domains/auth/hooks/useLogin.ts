import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth-store";

export function useLogin() {
  const login = useAuthStore((s) => s.login);
  return useMutation({
    mutationFn: ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) => login(username, password).catch((e) => console.log(e)),
  });
}
