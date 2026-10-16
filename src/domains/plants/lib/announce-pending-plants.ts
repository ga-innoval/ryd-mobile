import { toast } from "@/lib/toast";
import { buildPlantsDownloadNotification } from "@/domains/notifications/lib/plants-download-notification";
import { useNotificationsInbox } from "@/domains/notifications/store/notifications-inbox-store";

/**
 * Avisa de que hay plantaciones por descargar: el toast y, por si no alcanzó a
 * verse, un aviso en la bandeja de notificaciones.
 *
 * **Sin notificación del sistema**: el ping que lo dispara solo corre con la app en
 * primer plano, así que el toast ya fue el aviso en ese momento.
 *
 * Lo comparten el ping real (`usePendingPlants`) y la herramienta de desarrollo de
 * la campana, que lo dispara a mano: así lo que se prueba es exactamente lo mismo
 * que sale en producción, y no una copia que pueda diferir.
 */
export function announcePendingPlants(count: number) {
  toast.info({
    title: "Actualizaciones por descargar",
    description: "Se detectaron actualizaciones en las plantaciones.",
  });

  useNotificationsInbox
    .getState()
    .addMany([buildPlantsDownloadNotification(count, Date.now())]);
}
