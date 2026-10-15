import { useState } from "react";
import { View } from "react-native";
import { BellIcon } from "lucide-react-native";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { useAppRouter } from "@/lib/use-app-router";
import { useNotifications } from "../hooks/use-notifications";
import { DevNotificationDialog } from "./dev-notification-dialog";

/**
 * Con más de esto el número no cabe en un círculo de 16 px sobre un botón de
 * 32, y «27» ya no dice nada que «9+» no diga.
 */
const MAX_BADGE = 9;

/**
 * La campana de la cabecera principal, con el número de notificaciones sin
 * leer, y lleva a la pantalla de notificaciones.
 *
 * Inteligente a propósito, como `SyncBlock`: se pinta en la cabecera, fuera del
 * árbol de la pantalla, y nadie le puede pasar el conteo por props.
 *
 * **En desarrollo, mantenerla pulsada abre una herramienta** para programar una
 * notificación de prueba (`DevNotificationDialog`). Todo lo suyo va detrás de
 * `__DEV__`, que Metro vuelve `false` en producción: ni el gesto ni el diálogo
 * existen allí.
 */
export function NotificationsBell() {
  const router = useAppRouter();
  const { unreadCount } = useNotifications();
  const [devDialogOpen, setDevDialogOpen] = useState(false);

  return (
    <View>
      <IconButton
        onPress={() => router.push("/notifications")}
        onLongPress={__DEV__ ? () => setDevDialogOpen(true) : undefined}
        role="button"
        // El número es un dibujo para quien ve, así que tiene que ir también
        // en la etiqueta.
        aria-label={
          unreadCount > 0
            ? `Notificaciones, ${unreadCount} sin leer`
            : "Notificaciones"
        }
      >
        <Icon as={BellIcon} size={16} />
      </IconButton>

      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          // No intercepta toques: la esquina del botón sigue siendo del botón.
          pointerEvents="none"
          className="absolute -right-1.5 -top-1.5 h-4 min-w-4 px-1 py-0"
        >
          <Text className="text-[10px] font-bold leading-3">
            {unreadCount > MAX_BADGE ? `${MAX_BADGE}+` : unreadCount}
          </Text>
        </Badge>
      )}

      {__DEV__ && (
        <DevNotificationDialog
          open={devDialogOpen}
          onOpenChange={setDevDialogOpen}
        />
      )}
    </View>
  );
}
