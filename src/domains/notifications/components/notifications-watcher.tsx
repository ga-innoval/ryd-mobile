import { useEffect } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { useForegroundNotifications } from "../hooks/use-foreground-notifications";
import { useNotificationTap } from "../hooks/use-notification-tap";
import { refreshPostcosechaReminders } from "../lib/refresh-postcosecha-reminders";

/**
 * Lo que tiene que estar vivo mientras haya sesión: el manejo de los avisos que
 * llegan con la app abierta, abrir la evaluación al tocar uno, y el repaso de
 * los recordatorios al arrancar.
 *
 * No pinta nada. Va en el layout autenticado, como `PendingPlantsWatcher`, para
 * que se monte una sola vez y no antes de tener sesión.
 */
export function NotificationsWatcher() {
  const db = useSQLiteContext();

  useForegroundNotifications();
  useNotificationTap();

  // Al abrir: red de seguridad de lo que cambió por un camino que no repasó, y
  // lo que el tope de iOS dejó fuera cuando ya sonaron los de delante.
  useEffect(() => {
    void refreshPostcosechaReminders(db);
  }, [db]);

  return null;
}
