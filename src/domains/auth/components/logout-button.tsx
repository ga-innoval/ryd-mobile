import { ActivityIndicator } from "react-native";
import { LogOutIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { haptics } from "@/lib/haptics";

interface LogoutButtonProps {
  onLogOut: () => Promise<void>;
  loading?: boolean;
}

export function LogoutButton({ onLogOut, loading }: LogoutButtonProps) {
  const handleLogOut = () => {
    haptics.tap();
    onLogOut();
  };

  return (
    <Button
      variant="outline"
      className="flex-1"
      onPress={handleLogOut}
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
