import type { AppNotification } from "../types";

/**
 * La bandeja de notificaciones: lo recibido, de lo más nuevo a lo más viejo.
 *
 * Todo puro. El store solo guarda lo que esto decide, y así las reglas —duplicados,
 * tope, qué pasa al volver a ver algo ya leído— se prueban sin AsyncStorage.
 */

/**
 * Cuántos avisos se conservan. Es una bandeja, no un archivo: pasado esto salen
 * los más viejos. Sin tope, una tablet que lleva meses recibiendo recordatorios
 * escribiría en AsyncStorage una lista cada vez más larga con cada aviso nuevo.
 */
export const MAX_INBOX = 100;

const newestFirst = (a: AppNotification, b: AppNotification) =>
  b.createdAt - a.createdAt;

/**
 * Añade avisos, sin duplicar y sin pisar lo ya visto.
 *
 * **Un aviso que ya está se queda como estaba**, incluido su estado de leído.
 * Llega más de una vez por caminos distintos —el oyente de primer plano, el
 * barrido de las presentadas al volver, el toque que lo abre—, y el último en
 * llegar no puede devolver a «sin leer» lo que el evaluador ya abrió.
 */
export function addToInbox(
  inbox: readonly AppNotification[],
  incoming: readonly AppNotification[],
): AppNotification[] {
  const known = new Set(inbox.map((item) => item.id));
  const fresh: AppNotification[] = [];

  for (const item of incoming) {
    if (known.has(item.id)) continue;

    known.add(item.id);
    fresh.push(item);
  }

  if (fresh.length === 0) return inbox as AppNotification[];

  return [...inbox, ...fresh].sort(newestFirst).slice(0, MAX_INBOX);
}

export const markRead = (
  inbox: readonly AppNotification[],
  id: string,
): AppNotification[] =>
  inbox.some((item) => item.id === id && !item.read)
    ? inbox.map((item) => (item.id === id ? { ...item, read: true } : item))
    : (inbox as AppNotification[]);

export const markAllRead = (
  inbox: readonly AppNotification[],
): AppNotification[] =>
  inbox.some((item) => !item.read)
    ? inbox.map((item) => (item.read ? item : { ...item, read: true }))
    : (inbox as AppNotification[]);

/**
 * Junta lo guardado en disco con lo que ya llegó **mientras se leía**.
 *
 * AsyncStorage contesta tarde, y un aviso puede llegar antes —el toque que abre
 * la app estando cerrada lo añade en el primer render—. Con la fusión por defecto
 * de Zustand, que pisa, lo leído del disco se llevaría ese aviso por delante. Aquí
 * lo que ya estaba en memoria gana, porque es lo más reciente.
 */
export const mergeInboxes = (
  persisted: readonly AppNotification[],
  current: readonly AppNotification[],
): AppNotification[] => addToInbox(current, persisted);
