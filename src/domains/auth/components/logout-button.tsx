import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useState } from "react";
import { useAuthStore } from "../store/auth-store";

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    setIsLoading(true);
    await logout();
    setIsLoading(false);
  };

  return (
    <Button disabled={isLoading} onPress={handleLogout}>
      <Text>{isLoading ? "Cerrando..." : "Cerrar sesión"}</Text>
    </Button>
  );
}
