import { parseISODate, toISODate } from "@/lib/dates";
import { EVALS_POST_COSECHA } from "@/domains/plants/lib/evals-post-cosecha";
import {
  fechaEsperada,
  periodoDias,
} from "@/domains/plants/lib/postcosecha-fruta";

/**
 * Los recordatorios de «toca evaluar esta post-cosecha»: qué debería haber
 * programado el sistema operativo, y qué hay que hacer para que lo esté.
 *
 * Todo puro. Lo que habla con `expo-notifications` está en `reminders.ts`, que
 * es el único que lo importa —el mismo reparto que `photo-files.ts` con
 * `expo-file-system`—, y de aquí sale lo que ese archivo recibe ya decidido.
 */

/** Marca los identificadores de este tipo de aviso: lo que no la lleve no es
 *  nuestro y no se toca. */
export const REMINDER_PREFIX = "postcosecha:";

/** La hora del día en que suena, **en hora del dispositivo**. */
export const REMINDER_HOUR = 7;

/**
 * iOS conserva como máximo 64 notificaciones locales pendientes y descarta el
 * resto sin avisar. Se programan las más cercanas, y como el repaso se hace al
 * abrir la app, las que quedaron fuera entran cuando las de delante ya sonaron.
 */
export const MAX_PENDING_REMINDERS = 64;

/** Lo que hace falta saber de una evaluación empacada para avisar de ella. */
export type ReminderInput = {
  plantId: string;
  plantName: string;
  evalId: string;
  /** ISO, tal como se capturó. */
  fechaEmpaque: string;
  /** ISO, o vacío mientras no se haya evaluado. */
  fechaEvaluacion: string;
};

export type DesiredReminder = {
  identifier: string;
  /** Cuándo suena, en milisegundos desde la época. */
  fireAt: number;
  title: string;
  body: string;
  /** Para abrir la evaluación al tocar el aviso. */
  data: { plantId: string; evalId: string };
};

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** «15 de octubre», a mano: no se depende de `Intl` ni del idioma de la tablet. */
const longDate = (iso: string) => {
  const date = parseISODate(iso);

  return date ? `${date.getDate()} de ${MONTHS[date.getMonth()]}` : iso;
};

/**
 * **La fecha en que toca sale dentro del identificador.** Así, comparar lo que
 * se quiere contra lo programado es comparar textos: si el evaluador corrige la
 * fecha de empaque cambia el identificador, el viejo sobra y el nuevo falta, y
 * no hace falta leer de vuelta el disparador que guardó el sistema operativo —
 * cuya forma cambia entre iOS y Android—.
 */
export const reminderIdentifier = (
  plantId: string,
  evalId: string,
  dueISO: string,
) => `${REMINDER_PREFIX}${plantId}:${evalId}:${dueISO}`;

function buildReminder(input: ReminderInput, now: number) {
  // Evaluada ya —aunque sea antes de tiempo—, el aviso del día señalado sería
  // ruido: lo que avisa es justo lo que ya se hizo.
  if (input.fechaEvaluacion !== "") return null;

  const evaluacion = EVALS_POST_COSECHA.find(
    (item) => item.id === input.evalId,
  );
  if (!evaluacion) return null;

  const due = fechaEsperada(input.fechaEmpaque, periodoDias(input.evalId));
  const fireAt = parseISODate(due);
  if (!fireAt) return null;

  // `parseISODate` da la medianoche local; se sube a la hora del aviso sin pasar
  // por UTC, que de noche caería en otro día.
  fireAt.setHours(REMINDER_HOUR, 0, 0, 0);

  // Una hora que ya pasó no es un aviso, es un disparador inválido.
  if (fireAt.getTime() <= now) return null;

  const reminder: DesiredReminder = {
    identifier: reminderIdentifier(
      input.plantId,
      input.evalId,
      toISODate(fireAt),
    ),
    fireAt: fireAt.getTime(),
    title: `Evaluación de post-cosecha (${evaluacion.title}${evaluacion.subtitle[0]})`,
    body: `Hoy toca evaluar post-cosecha en variedad ${input.plantName}.`,
    data: { plantId: input.plantId, evalId: input.evalId },
  };

  return reminder;
}

/**
 * Los recordatorios que deberían existir ahora mismo, de los más próximos a los
 * más lejanos y sin pasar de `MAX_PENDING_REMINDERS`.
 *
 * `now` llega por argumento: lo que decide si una fecha ya pasó no puede
 * depender del reloj de quien llame.
 */
export function buildDesiredReminders(
  inputs: readonly ReminderInput[],
  now: number,
): DesiredReminder[] {
  return inputs
    .map((input) => buildReminder(input, now))
    .filter((reminder): reminder is DesiredReminder => reminder !== null)
    .sort((a, b) => a.fireAt - b.fireAt)
    .slice(0, MAX_PENDING_REMINDERS);
}

/**
 * Qué cancelar y qué programar para que lo programado sea lo que se quiere.
 *
 * Solo mira los identificadores con nuestro prefijo: cualquier otra
 * notificación pendiente —de este tipo de aviso no, pero sí de los que vendrán—
 * no es asunto de este repaso y **no se cancela**.
 */
export function planReminderChanges(
  desired: readonly DesiredReminder[],
  scheduledIds: readonly string[],
): { cancel: string[]; schedule: DesiredReminder[] } {
  const ours = scheduledIds.filter((id) => id.startsWith(REMINDER_PREFIX));
  const wanted = new Set(desired.map((reminder) => reminder.identifier));
  const have = new Set(ours);

  return {
    cancel: ours.filter((id) => !wanted.has(id)),
    schedule: desired.filter((reminder) => !have.has(reminder.identifier)),
  };
}
