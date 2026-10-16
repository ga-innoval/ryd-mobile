import { useMemo } from "react";
import { unreadCount } from "../lib/notification-filters";
import { useNotificationsInbox } from "../store/notifications-inbox-store";

/**
 * Las notificaciones recibidas y lo que se puede hacer con ellas.
 *
 * **Es la única fuente del conteo de sin leer.** La campana de la pantalla
 * principal y el «N sin leer» de la cabecera de notificaciones salen de aquí, así
 * que no pueden contradecirse.
 *
 * Lee la bandeja persistida. Quien la alimenta no es este hook: lo hacen el oyente
 * de primer plano, el barrido de las presentadas y el toque, en
 * `NotificationsWatcher`.
 */
export function useNotifications() {
  const notifications = useNotificationsInbox((state) => state.items);
  const markRead = useNotificationsInbox((state) => state.markRead);
  const markAllRead = useNotificationsInbox((state) => state.markAllRead);

  const unread = useMemo(() => unreadCount(notifications), [notifications]);

  return { notifications, unreadCount: unread, markRead, markAllRead };
}
