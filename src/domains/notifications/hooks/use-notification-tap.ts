import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { notificationFromOs } from "../lib/notification-from-os";
import { reminderTarget } from "../lib/reminder-target";
import { useNotificationsInbox } from "../store/notifications-inbox-store";
import { useOpenReminder } from "./use-open-reminder";

/**
 * Qué pasa al **tocar** una notificación del sistema: abre la evaluación que
 * avisa.
 *
 * Un solo hook cubre los tres casos, porque `useLastNotificationResponse`
 * devuelve tanto el toque que acaba de ocurrir con la app abierta o en segundo
 * plano como el que **la abrió estando cerrada**. Ese último es el delicado: la
 * respuesta ya existe cuando el componente monta.
 *
 * **Se limpia la respuesta antes de navegar.** El hook la sigue devolviendo en
 * cada render, y sin limpiarla un remonte de este componente —o volver a
 * abrirlo— llevaría otra vez a la misma evaluación, tirando de donde el
 * evaluador estuviera.
 *
 * Solo cuenta el toque normal (`DEFAULT_ACTION_IDENTIFIER`): descartar el aviso
 * también es una respuesta, y no es abrir nada.
 *
 * Se monta una sola vez, en el layout autenticado: sin sesión no hay
 * evaluación que abrir, y al iniciarla la respuesta pendiente sigue ahí.
 */
export function useNotificationTap() {
  const response = Notifications.useLastNotificationResponse();
  const open = useOpenReminder();

  useEffect(() => {
    if (!response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }

    const { notification } = response;
    const target = reminderTarget(notification.request.content.data);

    // **A la bandeja y leído.** Con la app cerrada, el toque es lo único que la
    // app llega a ver de ese aviso —el barrido de las presentadas no lo encuentra
    // porque iOS lo retira del Centro de notificaciones al tocarlo—, así que si no
    // entra aquí, no entra nunca. `addToInbox` no duplica si ya estaba.
    const { addMany, markRead } = useNotificationsInbox.getState();
    const item = notificationFromOs(notification, Date.now());
    if (item) addMany([item]);
    markRead(notification.request.identifier);

    Notifications.clearLastNotificationResponse();
    if (target) open(target);
  }, [response, open]);
}
