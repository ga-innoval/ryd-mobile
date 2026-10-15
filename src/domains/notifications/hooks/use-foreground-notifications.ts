import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { toast } from "@/lib/toast";
import { reminderTarget } from "../lib/reminder-target";
import { useOpenReminder } from "./use-open-reminder";

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
 * **Tocar el toast abre la evaluación**, igual que tocar la notificación del
 * sistema: con la app abierta el toast *es* el aviso, y que el mismo aviso
 * respondiera distinto según la app esté abierta o no sería raro.
 *
 * Se monta una sola vez, en el layout autenticado.
 */
export function useForegroundNotifications() {
  const open = useOpenReminder();

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
        const target = reminderTarget(request.content.data);

        toast.info({
          title: request.content.title ?? "Notificación",
          description: request.content.body ?? undefined,
          onPress: target ? () => open(target) : undefined,
        });
      },
    );

    return () => subscription.remove();
  }, [open]);
}
