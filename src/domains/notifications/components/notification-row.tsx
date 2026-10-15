import { Pressable, View } from "react-native";
import {
  CloudDownloadIcon,
  PackageIcon,
  RefreshCwIcon,
  type LucideIcon,
} from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { formatNotificationTime } from "../lib/format-notification-time";
import type { AppNotification, NotificationKind } from "../types";

const KIND_VIEW: Record<
  NotificationKind,
  { icon: LucideIcon; iconCn: string }
> = {
  "plants-download": { icon: CloudDownloadIcon, iconCn: "bg-leaf/20" },
  "postcosecha-reminder": { icon: PackageIcon, iconCn: "bg-secondary" },
  "sync-reminder": { icon: RefreshCwIcon, iconCn: "bg-leaf/20" },
};

type NotificationRowProps = {
  notification: AppNotification;
  now: number;
  /** Tocar la fila. Quien la pinta decide qué abre y la marca como leída. */
  onPress: (notification: AppNotification) => void;
};

/**
 * Una notificación: el icono de su tipo, la frase con el sujeto en negritas y la
 * hora. **La fila entera es la acción**: no lleva botón, tocarla abre lo que
 * avisa. Sin leer se distingue por el fondo y el punto.
 */
export function NotificationRow({
  notification,
  now,
  onPress,
}: NotificationRowProps) {
  const { icon, iconCn } = KIND_VIEW[notification.kind];
  const { subject, body, createdAt, read } = notification;

  return (
    <Pressable
      onPress={() => onPress(notification)}
      accessibilityRole="button"
      accessibilityLabel={`${read ? "" : "Sin leer. "}${subject} ${body}`}
      className={cn(
        "flex-row items-center gap-3 px-4 py-3",
        read ? "bg-card" : "bg-leaf/10",
      )}
    >
      <View
        className={cn(
          "size-10 items-center justify-center rounded-full",
          iconCn,
        )}
      >
        <Icon as={icon} size={18} className="text-foreground" />
      </View>

      <View className="flex-1 gap-0.5">
        {/* Los dos `Text` llevan el tamaño: el anidado no hereda `text-sm` y
            caería en el `text-base` por defecto. */}
        <Text className="text-sm">
          <Text className="text-sm font-bold">{subject}</Text> {body}
        </Text>
        <Text variant="muted" className="text-xs">
          {formatNotificationTime(createdAt, now)}
        </Text>
      </View>

      {/* Reserva el hueco aunque esté leída: sin él, el texto de las leídas
          sería más ancho que el de las que no y se verían desalineadas. */}
      <View
        className={cn("size-2 rounded-full", read ? "opacity-0" : "bg-leaf")}
      />
    </Pressable>
  );
}
