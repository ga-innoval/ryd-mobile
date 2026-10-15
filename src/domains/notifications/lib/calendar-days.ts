const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Cuántos días de calendario hay de `timestamp` a `now`: 0 es hoy, 1 es ayer.
 *
 * **Días de calendario en hora local, no bloques de 24 horas.** Lo que ocurrió
 * a las 11 p. m. de ayer es «ayer» aunque hayan pasado dos horas, y con
 * `toISOString()` o restando milisegundos de noche caería en el día equivocado
 * — el mismo cuidado que `lib/dates.ts`. El `round` absorbe el cambio de hora,
 * que hace días de 23 o 25 horas.
 *
 * Un instante del futuro —un reloj desajustado— cuenta como hoy: negativo no
 * tiene sentido en «hace N días».
 */
export function calendarDaysAgo(timestamp: number, now: number): number {
  const diff = startOfDay(new Date(now)).getTime() -
    startOfDay(new Date(timestamp)).getTime();

  return Math.max(0, Math.round(diff / DAY_MS));
}
