import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { planReminderChanges, type DesiredReminder } from "./reminder-plan";

/**
 * Lo que habla con `expo-notifications` para los recordatorios, y **el único
 * archivo que lo importa para programar**. Es el mismo reparto de
 * `photo-files.ts` con `expo-file-system`: lo que decide qué programar vive en
 * `reminder-plan.ts`, puro y probado, y esto solo lo ejecuta.
 */

/** Android exige un canal para toda notificación desde la 8.0. */
const CHANNEL_ID = "post-cosecha";

const isGranted = (status: Notifications.NotificationPermissionsStatus) =>
  status.granted ||
  status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

/**
 * Si se puede avisar, pidiendo el permiso la primera vez.
 *
 * **Es un sustituto, y está dicho en CLAUDE.md:** el sitio de pedirlo es un
 * modal de introducción que explique por qué importan estos avisos, no el
 * instante en que se guarda una fecha. Mientras no exista, pedirlo aquí es lo
 * único que deja probar el flujo.
 *
 * Si el usuario dice que no, **se calla**: iOS no vuelve a preguntar —
 * `canAskAgain` queda en falso—, así que reintentar en cada guardado no molesta
 * a nadie, y los recordatorios se programan solos el día que lo active él en
 * Ajustes.
 */
async function ensurePermission(): Promise<boolean> {
  // El canal va antes que el permiso: desde Android 13 el aviso del sistema no
  // sale hasta que existe uno.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Evaluaciones de post-cosecha",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current)) return true;
  if (!current.canAskAgain) return false;

  return isGranted(await Notifications.requestPermissionsAsync());
}

/**
 * Deja programado en el sistema lo que se quiere: cancela lo que sobra y añade
 * lo que falta.
 *
 * Cancelar no pide permiso, así que se hace siempre: un aviso que ya no toca no
 * puede sonar porque el usuario lo haya desactivado después.
 */
export async function syncReminders(
  desired: readonly DesiredReminder[],
): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const { cancel, schedule } = planReminderChanges(
    desired,
    scheduled.map((request) => request.identifier),
  );

  await Promise.all(
    cancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
  );

  if (schedule.length === 0) return;
  if (!(await ensurePermission())) return;

  for (const reminder of schedule) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.identifier,
      content: {
        title: reminder.title,
        body: reminder.body,
        data: reminder.data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminder.fireAt),
        channelId: CHANNEL_ID,
      },
    });
  }
}
