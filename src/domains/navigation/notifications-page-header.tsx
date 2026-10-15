import { View } from "react-native";
import { ArrowLeft, CheckCheckIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { TextButton } from "@/components/ui/text-button";
import { useAppRouter } from "@/lib/use-app-router";
import { useNotifications } from "@/domains/notifications/hooks/use-notifications";
import { HeaderBase } from "./header-base";

/**
 * La cabecera de la pantalla de notificaciones: volver, el título con cuántas
 * quedan por leer, y marcarlas todas.
 *
 * Lee el conteo del mismo hook que la campana, así que lo que dice aquí y lo
 * que decía el badge al entrar no pueden diferir.
 */
export function NotificationsPageHeader() {
  const router = useAppRouter();
  const { unreadCount, markAllRead } = useNotifications();

  return (
    <HeaderBase>
      <View className="flex-row items-center gap-4">
        <IconButton
          onPress={() => router.back()}
          role="button"
          aria-label="Volver"
        >
          <Icon size={16} as={ArrowLeft} className="text-white" />
        </IconButton>

        <View>
          <Text className="font-bold text-primary-foreground">
            Notificaciones
          </Text>
          <Text className="text-xs text-primary-foreground/70">
            {unreadCount === 0 ? "Todo leído" : `${unreadCount} sin leer`}
          </Text>
        </View>
      </View>

      {/* Se apaga y no se esconde cuando no queda nada: el botón sigue en su
          sitio y dice, con eso, que no hay más por hacer. */}
      <TextButton
        icon={CheckCheckIcon}
        onPress={markAllRead}
        disabled={unreadCount === 0}
      >
        Marcar todo como leído
      </TextButton>
    </HeaderBase>
  );
}
