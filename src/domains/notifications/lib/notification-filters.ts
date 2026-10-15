import type {
  AppNotification,
  NotificationCategory,
  NotificationFilter,
  NotificationKind,
} from "../types";

/**
 * A qué chip pertenece cada tipo. **El reparto es forzado**: con tres tipos y
 * dos categorías alguna comparte. Descargar y mandar son los dos sentidos de
 * mover datos entre tablet y servidor; el recordatorio de evaluar es lo que le
 * pide algo al evaluador. Cambiar de idea es cambiar una línea de esta tabla.
 */
export const NOTIFICATION_CATEGORY: Record<
  NotificationKind,
  NotificationCategory
> = {
  "plants-download": "sincronizacion",
  "sync-reminder": "sincronizacion",
  "postcosecha-reminder": "alertas",
};

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
    default:
      return notifications.filter(
        (notification) => NOTIFICATION_CATEGORY[notification.kind] === filter,
      );
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
    alertas: filterNotifications(notifications, "alertas").length,
    sincronizacion: filterNotifications(notifications, "sincronizacion").length,
  };
}
