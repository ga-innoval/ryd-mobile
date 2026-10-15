import { useEffect } from "react";
import { AppState } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useForegroundNotifications } from "../hooks/use-foreground-notifications";
import { useNotificationTap } from "../hooks/use-notification-tap";
import { refreshPostcosechaReminders } from "../lib/refresh-postcosecha-reminders";
import { returnedFromBackground } from "../lib/returned-from-background";

/**
 * Lo que tiene que estar vivo mientras haya sesión: el manejo de los avisos que
 * llegan con la app abierta, abrir la evaluación al tocar uno, y el repaso de
 * los recordatorios al arrancar y al volver de segundo plano.
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

  // Y al volver de segundo plano. **Una tablet de campo casi nunca arranca de
  // cero**: la app se queda en segundo plano días enteros, así que solo repasar
  // al arrancar dejaría sin corregir lo que cambia mientras tanto:
  //
  // - **El permiso**, que es lo que más importa: quien lo activó en Ajustes
  //   después de decir que no recupera sus recordatorios al volver, sin tener que
  //   matar la app. Es lo que hace cierto el «se omiten en silencio hasta que lo
  //   active él».
  // - Lo que el tope de iOS dejó fuera y ya tiene hueco porque sonaron los de
  //   delante.
  //
  // El repaso va en cola y no lanza, así que dos seguidos no se pisan.
  useEffect(() => {
    let previous = AppState.currentState;

    const subscription = AppState.addEventListener("change", (next) => {
      if (returnedFromBackground(previous, next)) {
        void refreshPostcosechaReminders(db);
      }

      previous = next;
    });

    return () => subscription.remove();
  }, [db]);

  return null;
}
