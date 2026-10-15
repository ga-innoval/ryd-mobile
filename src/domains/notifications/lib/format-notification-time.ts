import { calendarDaysAgo } from "./calendar-days";

const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const MINUTE_MS = 60 * 1000;

/** «4:40 p.m.», a mano: no se depende de `Intl` y del idioma de la tablet. */
const clock = (date: Date) => {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "a.m." : "p.m."}`;
};

/**
 * Cuándo pasó, como lo diría una persona: «Hace 12 min», «Ayer, 4:40 p.m.»,
 * «Martes, 9:12 a.m.», «8 oct».
 *
 * Hoy es relativo y lo demás es absoluto: «hace 3 h» sirve mientras se está
 * mirando, pero «hace 5 días» obliga a contar. El corte de los días coincide con
 * `groupByRecency`, que usa el mismo `calendarDaysAgo`, así que una nota de
 * «Esta semana» nunca dice una fecha y una de «Hoy» nunca dice un día.
 */
export function formatNotificationTime(timestamp: number, now: number): string {
  const date = new Date(timestamp);
  const days = calendarDaysAgo(timestamp, now);

  if (days === 0) {
    const minutes = Math.floor(Math.max(0, now - timestamp) / MINUTE_MS);

    if (minutes < 1) return "Hace un momento";
    if (minutes < 60) return `Hace ${minutes} min`;

    return `Hace ${Math.floor(minutes / 60)} h`;
  }

  if (days === 1) return `Ayer, ${clock(date)}`;
  if (days <= 6) return `${WEEKDAYS[date.getDay()]}, ${clock(date)}`;

  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  const day = `${date.getDate()} ${MONTHS[date.getMonth()]}`;

  return sameYear ? day : `${day} ${date.getFullYear()}`;
}
