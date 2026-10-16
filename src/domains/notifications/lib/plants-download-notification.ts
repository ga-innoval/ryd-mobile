import type { AppNotification } from "../types";

/**
 * El aviso de «hay plantaciones por descargar», para la bandeja.
 *
 * Es el mismo aviso que ya sale como toast cuando el ping detecta cambios; entra
 * también a la bandeja por si el usuario no alcanzó a verlo. **No hay notificación
 * del sistema**: el ping solo corre con la app en primer plano, así que el toast
 * ya fue el aviso en ese momento.
 *
 * Su identificador lleva el instante, porque cada detección es un aviso distinto
 * —el ping solo avisa al pasar de cero a algo pendiente—, y la bandeja descarta lo
 * que repite identificador.
 */
export function buildPlantsDownloadNotification(
  count: number,
  now: number,
): AppNotification {
  return {
    id: `plants-download:${now}`,
    kind: "plants-download",
    subject: "Actualizaciones por descargar",
    body:
      count === 1
        ? "Se detectaron cambios en 1 plantación."
        : `Se detectaron cambios en ${count} plantaciones.`,
    createdAt: now,
    read: false,
  };
}
