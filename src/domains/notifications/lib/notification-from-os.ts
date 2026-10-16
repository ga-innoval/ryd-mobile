import type { AppNotification } from "../types";
import { reminderTarget } from "./reminder-target";

/**
 * Lo que de una notificación del sistema hace falta para meterla en la bandeja.
 * Es la forma estructural de `Notification` de `expo-notifications`, declarada
 * aquí para que esta lógica no importe el módulo nativo.
 */
export type OsNotification = {
  date: number;
  request: {
    identifier: string;
    content: {
      title: string | null;
      body: string | null;
      /** Opcional, como en `expo-notifications`: un aviso puede no traerlo. */
      data?: unknown;
    };
  };
};

/**
 * Cuándo llegó, en milisegundos.
 *
 * `Notification.date` no promete la unidad: según plataforma llega en segundos o
 * en milisegundos. Un milisegundo de hoy ronda 1.7 billones y unos segundos de hoy
 * 1.7 mil millones, así que por debajo de un billón son segundos. Lo que no sea un
 * número útil cae en `fallback`, que es cuando la app lo vio.
 */
export function osDateToMs(date: unknown, fallback: number): number {
  if (typeof date !== "number" || !Number.isFinite(date) || date <= 0) {
    return fallback;
  }

  return date < 1e12 ? date * 1000 : date;
}

/**
 * Convierte lo que entrega el sistema en un aviso de la bandeja, o `null` si no
 * es de los que la app reconoce.
 *
 * **Hoy solo se reconoce el recordatorio de post-cosecha**, por llevar la
 * plantación y la evaluación en su `data`: es el único con quien lo programe. Lo
 * demás no entra, porque la bandeja no tiene dónde ponerlo. Cuando otro tipo tenga
 * productor, es una rama más aquí.
 *
 * El identificador del sistema es el de la bandeja, y de ahí sale que el mismo
 * aviso, visto por caminos distintos, no se duplique.
 */
export function notificationFromOs(
  notification: OsNotification,
  receivedAt: number,
): AppNotification | null {
  const { identifier, content } = notification.request;
  const target = reminderTarget(content.data);

  if (!target) return null;

  return {
    id: identifier,
    kind: "postcosecha-reminder",
    subject: content.title ?? "Evaluación de post-cosecha",
    body: content.body ?? "",
    createdAt: osDateToMs(notification.date, receivedAt),
    read: false,
    plantId: target.plantId,
    evalId: target.evalId,
  };
}
