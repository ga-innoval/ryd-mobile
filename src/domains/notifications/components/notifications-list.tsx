import { View } from "react-native";
import { Text } from "@/components/ui/text";
import type { NotificationSection } from "../lib/group-by-recency";
import type { AppNotification } from "../types";
import { NotificationRow } from "./notification-row";

type NotificationsListProps = {
  sections: NotificationSection[];
  now: number;
  onPressNotification: (notification: AppNotification) => void;
};

/**
 * Las notificaciones agrupadas por cuándo ocurrieron, cada bloque en su tarjeta.
 *
 * Un `View` por bloque y no una `SectionList`: son decenas, no miles, y el
 * dibujo de cada bloque como una sola tarjeta con renglones separados es más
 * fácil de decir con elementos que con los separadores de una lista. Si algún
 * día crece sin tope, es lo primero que hay que cambiar.
 */
export function NotificationsList({
  sections,
  now,
  onPressNotification,
}: NotificationsListProps) {
  return (
    <View className="gap-5">
      {sections.map((section) => (
        <View key={section.bucket} className="gap-2">
          <Text className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {section.label}
          </Text>

          <View className="overflow-hidden rounded-2xl border border-border bg-card">
            {section.items.map((notification, index) => (
              <View
                key={notification.id}
                className={index > 0 ? "border-t border-border" : undefined}
              >
                <NotificationRow
                  notification={notification}
                  now={now}
                  onPress={onPressNotification}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
