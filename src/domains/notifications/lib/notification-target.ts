import type { AppNotification } from "../types";

/** A dónde lleva tocar una notificación. */
export type NotificationTarget =
  | { screen: "home" }
  | { screen: "postcosecha"; plantId: string; evalId: string };

/**
 * Descargar y mandar no tienen pantalla propia: se hacen desde la principal,
 * que es donde están `DownloadBlock` y `SyncBlock`, así que esos avisos llevan
 * allí. Evaluar sí tiene destino: la evaluación de post-cosecha que toca.
 *
 * Es una función aparte, y no un `if` en la pantalla, para que la regla de
 * «qué abre cada tipo» se pueda probar sin montar navegación.
 */
export function notificationTarget(
  notification: AppNotification,
): NotificationTarget {
  if (notification.kind === "postcosecha-reminder") {
    return {
      screen: "postcosecha",
      plantId: notification.plantId,
      evalId: notification.evalId,
    };
  }

  return { screen: "home" };
}
