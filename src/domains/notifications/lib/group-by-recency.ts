import type { AppNotification } from "../types";
import { calendarDaysAgo } from "./calendar-days";

export type RecencyBucket = "today" | "week" | "older";

export const RECENCY_LABEL: Record<RecencyBucket, string> = {
  today: "Hoy",
  week: "Esta semana",
  older: "Anteriores",
};

const ORDER: RecencyBucket[] = ["today", "week", "older"];

/** Los seis días anteriores a hoy: con hoy, una semana corrida. */
const WEEK_DAYS = 6;

export const recencyBucket = (timestamp: number, now: number): RecencyBucket => {
  const days = calendarDaysAgo(timestamp, now);

  if (days === 0) return "today";
  if (days <= WEEK_DAYS) return "week";

  return "older";
};

export type NotificationSection = {
  bucket: RecencyBucket;
  label: string;
  items: AppNotification[];
};

/**
 * Reparte las notificaciones en Hoy / Esta semana / Anteriores, de la más
 * reciente a la más vieja dentro de cada bloque.
 *
 * **«Esta semana» es una semana corrida, no la de calendario.** Con la de
 * calendario, un lunes «esta semana» sería solo hoy y el viernes anterior
 * caería en «Anteriores» aunque sea de hace tres días. Una ventana corrida
 * dice lo mismo todos los días.
 *
 * Los bloques vacíos no se devuelven: un encabezado sin nada debajo no dice
 * nada. `now` llega por argumento y no se lee aquí, para que sea puro.
 */
export function groupByRecency(
  notifications: readonly AppNotification[],
  now: number,
): NotificationSection[] {
  const buckets: Record<RecencyBucket, AppNotification[]> = {
    today: [],
    week: [],
    older: [],
  };

  for (const notification of notifications) {
    buckets[recencyBucket(notification.createdAt, now)].push(notification);
  }

  return ORDER.filter((bucket) => buckets[bucket].length > 0).map((bucket) => ({
    bucket,
    label: RECENCY_LABEL[bucket],
    items: [...buckets[bucket]].sort((a, b) => b.createdAt - a.createdAt),
  }));
}
