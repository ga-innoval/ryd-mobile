import * as Notifications from "expo-notifications";
import type { AppNotification } from "../types";
import { notificationFromOs } from "./notification-from-os";

/**
 * Los avisos que llegaron mientras la app no miraba y **siguen en el Centro de
 * notificaciones**, ya convertidos a la bandeja.
 *
 * Es el único camino para esos: con la app en segundo plano o cerrada el oyente de
 * primer plano no se entera de nada. Por eso se llama al arrancar y al volver de
 * segundo plano. **Lo que el usuario descartó sin abrirla no está aquí**, y no hay
 * forma de enterarse: iOS no avisa a la app de que borraste una notificación.
 *
 * Lo que ya estaba en la bandeja lo descarta `addToInbox` por su identificador, así
 * que barrer varias veces lo mismo no duplica ni devuelve nada a «sin leer».
 */
export async function getPresentedAsInbox(
  now: number,
): Promise<AppNotification[]> {
  const presented = await Notifications.getPresentedNotificationsAsync();

  return presented.flatMap((notification) => {
    const item = notificationFromOs(notification, now);

    return item ? [item] : [];
  });
}
