import { useState } from "react";
import { ActivityIndicator } from "react-native";
import { LogOutIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

interface LogoutButtonProps {
  onLogOut: () => Promise<void>;
  loading?: boolean;
}

export function LogoutButton({ onLogOut, loading }: LogoutButtonProps) {
  return (
    <Button
      variant="outline"
      className="flex-1"
      onPress={onLogOut}
      disabled={loading}
    >
      {loading ? (
        <>
          <ActivityIndicator className="text-primary" />
          <Text>Cerrando...</Text>
        </>
      ) : (
        <>
          <Icon as={LogOutIcon} className="size-4" />
          <Text>Cerrar sesión</Text>
        </>
      )}
    </Button>
  );
}
