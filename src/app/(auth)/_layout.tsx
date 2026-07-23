import { Redirect, Slot } from "expo-router";
import { useAuthStore } from "@/domains/auth/store/auth-store";

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) return null;
  if (isAuthenticated) return <Redirect href="/" />;
  return <Slot />;
}
