/** La evaluación que un recordatorio abre al tocarlo. */
export type ReminderTarget = { plantId: string; evalId: string };

/**
 * Lo que viaja en el `data` de un recordatorio, leído de vuelta.
 *
 * **Recibe `unknown` porque el sistema operativo lo devuelve sin tipo**: el
 * `data` sale de un aviso programado hace días, quizá por una versión anterior
 * de la app, y en cualquier caso no es nuestro código quien lo escribe en ese
 * momento. Lo que no tenga la forma esperada responde `null` y no abre nada:
 * un toque que no lleva a ningún sitio es mejor que uno que revienta o que abre
 * una evaluación que no es.
 *
 * Solo exige cadenas no vacías. Que la plantación o la evaluación ya no existan
 * lo resuelve la pantalla de destino, que ya sabe qué enseñar sin ellas.
 */
export function reminderTarget(data: unknown): ReminderTarget | null {
  if (data === null || typeof data !== "object") return null;

  const { plantId, evalId } = data as Record<string, unknown>;

  if (typeof plantId !== "string" || plantId === "") return null;
  if (typeof evalId !== "string" || evalId === "") return null;

  return { plantId, evalId };
}
