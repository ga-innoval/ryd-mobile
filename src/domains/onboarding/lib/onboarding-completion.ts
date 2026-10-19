/**
 * Quién ya pasó por el onboarding, en una tablet que puede compartirse.
 *
 * La llave es el id del **usuario**, no el del dispositivo: dos evaluadores que
 * usan la misma tablet ven cada uno su primera vez. Todo puro; el store solo
 * guarda lo que esto decide.
 */

/**
 * Si este usuario ya completó el onboarding.
 *
 * **Sin usuario se responde que sí.** Es un estado que no debería existir —con
 * sesión siempre hay usuario—, pero si ocurre no hay forma de recordar nada de
 * quien no se puede identificar, y encerrarlo en un onboarding que no podría
 * terminar de registrar sería peor que saltárselo.
 */
export function hasCompletedOnboarding(
  completedIds: readonly string[],
  userId: string | null,
): boolean {
  if (userId === null) return true;

  return completedIds.includes(userId);
}

/** Añade un usuario sin duplicarlo. Devuelve la misma lista si ya estaba. */
export function addCompleted(
  completedIds: readonly string[],
  userId: string,
): string[] {
  return completedIds.includes(userId)
    ? (completedIds as string[])
    : [...completedIds, userId];
}

/** Quita un usuario. Devuelve la misma lista si no estaba. */
export function removeCompleted(
  completedIds: readonly string[],
  userId: string,
): string[] {
  return completedIds.includes(userId)
    ? completedIds.filter((id) => id !== userId)
    : (completedIds as string[]);
}

/**
 * Lee lo guardado en disco, que llega sin tipo: lo que no sea texto se descarta
 * en vez de tumbar el arranque, y los repetidos se juntan.
 */
export function parseCompletedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value.filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];
}

/**
 * Junta lo del disco con lo que ya había en memoria, sin perder ninguno.
 *
 * AsyncStorage contesta tarde y la fusión por defecto de Zustand pisa: un usuario
 * marcado antes de que llegara el disco se perdería.
 */
export const mergeCompletedIds = (
  persisted: readonly string[],
  current: readonly string[],
): string[] => [...new Set([...persisted, ...current])];

export type OnboardingGate = "loading" | "required" | "done";

/**
 * Qué toca hacer al entrar a la app con sesión.
 *
 * **`loading` hasta que el disco haya contestado.** Sin eso, la primera vez que
 * se pinta aún no se sabe quién completó el onboarding, y la app enseñaría un
 * instante la pantalla principal —a quien debería ver el onboarding— o al revés.
 */
export function onboardingGate({
  hydrated,
  userId,
  completedIds,
}: {
  hydrated: boolean;
  userId: string | null;
  completedIds: readonly string[];
}): OnboardingGate {
  if (!hydrated) return "loading";

  return hasCompletedOnboarding(completedIds, userId) ? "done" : "required";
}
