import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { toast } from "@/lib/toast";

/**
 * Qué pasa con un aviso que llega **con la app abierta**.
 *
 * El sistema operativo no lo enseña —el manejador responde que no a las cuatro
 * formas de mostrarlo— y en su lugar sale el toast de la propia app, que es lo
 * que ya ve el evaluador para todo lo demás. Con la app en segundo plano el
 * manejador ni se consulta y sale la notificación normal del sistema.
 *
 * **El manejador decide si se muestra; el oyente reacciona.** Son dos piezas
 * porque `expo-notifications` las separa así: el manejador responde en menos de
 * tres segundos o el aviso se descarta, y no es sitio para trabajo de la app.
 *
 * Se monta una sola vez, en el layout autenticado.
 */
export function useForegroundNotifications() {
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    const subscription = Notifications.addNotificationReceivedListener(
      ({ request }) => {
        toast.info({
          title: request.content.title ?? "Notificación",
          description: request.content.body ?? undefined,
        });
      },
    );

    return () => subscription.remove();
  }, []);
}
