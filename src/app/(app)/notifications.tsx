import { useCallback, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Stack } from "expo-router";
import { BellOffIcon } from "lucide-react-native";
import { useAppRouter } from "@/lib/use-app-router";
import { EmptyState } from "@/components/empty-state";
import { NotificationsPageHeader } from "@/domains/navigation/notifications-page-header";
import { ListFilter } from "@/domains/plants/components/list-filter";
import { NotificationsList } from "@/domains/notifications/components/notifications-list";
import { useNotifications } from "@/domains/notifications/hooks/use-notifications";
import { groupByRecency } from "@/domains/notifications/lib/group-by-recency";
import {
  countByFilter,
  filterNotifications,
} from "@/domains/notifications/lib/notification-filters";
import { notificationTarget } from "@/domains/notifications/lib/notification-target";
import type {
  AppNotification,
  NotificationFilter,
} from "@/domains/notifications/types";

// Fuera del componente: la función de `header` tiene que ser estable o el
// navigator monta la cabecera de nuevo en cada render de la pantalla.
const screenOptions = {
  title: "Notificaciones",
  header: () => <NotificationsPageHeader />,
};

const FILTERS: { label: string; value: NotificationFilter }[] = [
  { label: "Todas", value: "todas" },
  { label: "Sin leer", value: "sin-leer" },
  { label: "Alertas", value: "alertas" },
  { label: "Sincronización", value: "sincronizacion" },
];

export default function NotificationsScreen() {
  const router = useAppRouter();
  const { notifications, now, markRead } = useNotifications();
  const [filter, setFilter] = useState<NotificationFilter>("todas");

  /**
   * Tocar una fila la marca como leída **y** abre lo que avisa. Las de evaluar
   * llevan a su evaluación; descargar y enviar se hacen desde la pantalla
   * principal, así que vuelven a ella: `dismissTo` y no `push`, para no apilar
   * una segunda copia del listado debajo de las notificaciones.
   */
  const handlePress = useCallback(
    (notification: AppNotification) => {
      markRead(notification.id);

      const target = notificationTarget(notification);

      if (target.screen === "postcosecha") {
        router.push({
          pathname: "/postcosecha/[id]",
          params: { id: target.plantId, eval: target.evalId },
        });
      } else {
        router.dismissTo("/");
      }
    },
    [markRead, router],
  );

  const counts = useMemo(() => countByFilter(notifications), [notifications]);
  const filterItems = useMemo(
    () => FILTERS.map((item) => ({ ...item, count: counts[item.value] })),
    [counts],
  );
  const sections = useMemo(
    () => groupByRecency(filterNotifications(notifications, filter), now),
    [notifications, filter, now],
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={screenOptions} />

      <ScrollView contentContainerClassName="gap-4 p-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ListFilter
            selectedItem={filter}
            onItemPress={setFilter}
            items={filterItems}
          />
        </ScrollView>

        {sections.length === 0 ? (
          <EmptyState
            icon={BellOffIcon}
            title={
              filter === "todas" ? "Sin notificaciones" : "Nada en este filtro"
            }
            body={
              filter === "todas"
                ? "Aquí aparecerán los avisos de descargas, evaluaciones y envíos."
                : "Prueba con otro filtro para ver el resto."
            }
          />
        ) : (
          <NotificationsList
            sections={sections}
            now={now}
            onPressNotification={handlePress}
          />
        )}
      </ScrollView>
    </View>
  );
}
