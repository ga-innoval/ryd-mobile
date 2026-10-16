import type { AppNotification, NotificationFilter } from "../types";

export const unreadCount = (notifications: readonly AppNotification[]) =>
  notifications.filter((notification) => !notification.read).length;

export function filterNotifications(
  notifications: readonly AppNotification[],
  filter: NotificationFilter,
): AppNotification[] {
  switch (filter) {
    case "todas":
      return [...notifications];
    case "sin-leer":
      return notifications.filter((notification) => !notification.read);
    case "leidas":
      return notifications.filter((notification) => notification.read);
  }
}

/** El número de cada chip. Sale de `filterNotifications` para que el chip y la
 *  lista que enseña al pulsarlo no puedan contar distinto. */
export function countByFilter(
  notifications: readonly AppNotification[],
): Record<NotificationFilter, number> {
  return {
    todas: notifications.length,
    "sin-leer": filterNotifications(notifications, "sin-leer").length,
    leidas: filterNotifications(notifications, "leidas").length,
  };
}
