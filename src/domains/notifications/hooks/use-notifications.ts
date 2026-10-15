import { useCallback, useMemo } from "react";
import { MOCK_NOTIFICATIONS, MOCK_NOW } from "../lib/notifications-mock";
import { unreadCount } from "../lib/notification-filters";
import { useNotificationsReadStore } from "../store/notifications-read-store";

/**
 * Las notificaciones, con lo leído ya resuelto, y lo que se puede hacer con
 * ellas.
 *
 * **Es la única fuente del conteo de sin leer.** La campana de la pantalla
 * principal y el «N sin leer» de la cabecera de notificaciones salen de aquí, así
 * que no pueden contradecirse.
 *
 * Hoy lee un mock. El día que haya datos reales es este hook lo que cambia —la
 * lista pasa a derivarse de SQLite y `now` a ser un reloj—, y ni la campana ni la
 * pantalla se enteran.
 */
export function useNotifications() {
  const readIds = useNotificationsReadStore((state) => state.readIds);
  const markRead = useNotificationsReadStore((state) => state.markRead);
  const markAll = useNotificationsReadStore((state) => state.markAllRead);

  const notifications = useMemo(
    () =>
      MOCK_NOTIFICATIONS.map((notification) => ({
        ...notification,
        read: notification.read || readIds.has(notification.id),
      })),
    [readIds],
  );

  const unread = useMemo(() => unreadCount(notifications), [notifications]);

  const markAllRead = useCallback(
    () => markAll(MOCK_NOTIFICATIONS.map((notification) => notification.id)),
    [markAll],
  );

  return {
    notifications,
    now: MOCK_NOW,
    unreadCount: unread,
    markRead,
    markAllRead,
  };
}
