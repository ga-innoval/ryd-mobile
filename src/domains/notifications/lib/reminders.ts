import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { PermissionStatus } from "@/lib/permission-action";
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
 * Android exige un canal para toda notificación desde la 8.0, y desde Android 13
 * el aviso del sistema no sale hasta que existe uno. Va antes de leer o pedir el
 * permiso.
 */
async function ensureChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Evaluaciones de post-cosecha",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

const toStatus = (status: Notifications.NotificationPermissionsStatus) => ({
  granted: isGranted(status),
  canAskAgain: status.canAskAgain,
});

/** Cómo está el permiso de notificaciones, sin pedir nada. */
export async function getNotificationPermission(): Promise<PermissionStatus> {
  await ensureChannel();

  return toStatus(await Notifications.getPermissionsAsync());
}

/**
 * Pregunta por el permiso. **Solo lo llama el onboarding**: es el único sitio
 * donde el usuario ha leído por qué importan estos avisos.
 */
export async function requestNotificationPermission(): Promise<PermissionStatus> {
  await ensureChannel();

  return toStatus(await Notifications.requestPermissionsAsync());
}

/**
 * Si se puede avisar. **Solo comprueba, nunca pregunta.**
 *
 * Antes pedía el permiso la primera vez que se programaba algo —al guardar una
 * fecha de empaque, sin contexto—, y eso era un sustituto declarado hasta que
 * hubiera onboarding. Ya lo hay: quien dijo «ahora no» no recibe avisos y **no se
 * le vuelve a preguntar**, y los recordatorios se programan solos el día que lo
 * active en Ajustes, porque el repaso corre al volver a la app.
 */
async function ensurePermission(): Promise<boolean> {
  return (await getNotificationPermission()).granted;
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

/**
 * El prefijo de los avisos de prueba (`scheduleTestNotification`).
 *
 * **Distinto del de los recordatorios a propósito**: `syncReminders` cancela todo
 * lo que lleve `postcosecha:` y no esté en lo que se quiere, así que un aviso de
 * prueba con ese prefijo se cancelaría solo en el siguiente repaso —al guardar, al
 * volver de segundo plano—. Con otro prefijo no es asunto del repaso y se deja en
 * paz. Hay un test que lo fija.
 */
export const DEV_TEST_PREFIX = "dev-test:";

/**
 * Programa un aviso suelto para dentro de `delayMs`, **para probar a mano** cómo
 * se ve y cómo se comporta —el del sistema con la app en segundo plano, el toast
 * con ella abierta—. Solo lo llama la herramienta de desarrollo de la campana.
 *
 * Responde `false`, sin programar nada, si no hay permiso: no es un fallo, es el
 * mismo silencio que los recordatorios de verdad.
 */
export async function scheduleTestNotification({
  delayMs,
  title,
  body,
  data,
}: {
  delayMs: number;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<boolean> {
  if (!(await ensurePermission())) return false;

  await Notifications.scheduleNotificationAsync({
    identifier: `${DEV_TEST_PREFIX}${Date.now()}`,
    content: { title, body, data },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + delayMs),
      channelId: CHANNEL_ID,
    },
  });

  return true;
}
