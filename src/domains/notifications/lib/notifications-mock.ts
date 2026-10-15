import type { AppNotification } from "../types";

/**
 * Las ids de dos plantaciones reales —«518» y «Candy Dreams»—, para que los
 * recordatorios de post-cosecha lleven de verdad a una evaluación. Salen de lo
 * que descarga el usuario de pruebas: con otra cuenta no existen y la pantalla
 * de destino saldría vacía. Con datos reales esto desaparece.
 */
const PLANT_518 = "7ffe3f61-5050-4f2b-b99b-202e7bb96946";
const PLANT_CANDY_DREAMS = "96bc9044-2a32-4f05-b47e-ad6b5bfeb192";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * El «ahora» de los datos de mentira, fijado al cargar el módulo. Así la lista
 * se arma una sola vez y la campana y la pantalla ven exactamente las mismas
 * notificaciones, con los mismos ids y las mismas horas.
 */
export const MOCK_NOW = Date.now();

/** A las 4:40 p.m. de hace `days` días: para las que dicen una hora concreta. */
const atFourForty = (days: number) => {
  const date = new Date(MOCK_NOW);
  date.setDate(date.getDate() - days);
  date.setHours(16, 40, 0, 0);

  return date.getTime();
};

/**
 * **Datos de mentira**, hasta que haya de dónde derivarlas: las tres se
 * calcularán de SQLite —lo descargable, lo evaluable y lo pendiente de enviar—.
 *
 * Las horas son relativas a `MOCK_NOW` y no fechas fijas, para que Hoy / Esta
 * semana / Anteriores salgan siempre con algo. Cuatro sin leer, como en el
 * diseño.
 */
export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    kind: "plants-download",
    subject: "Candy Dreams",
    body: "se asignó a tu usuario. Campo Pozo Manuel · Cuadro 6A · 2026.",
    createdAt: MOCK_NOW - 12 * MINUTE,
    read: false,
  },
  {
    id: "n2",
    kind: "sync-reminder",
    subject: "Sincronización",
    body: "tienes 2 plantaciones con capturas sin enviar.",
    createdAt: MOCK_NOW - 1 * HOUR,
    read: false,
  },
  {
    id: "n3",
    kind: "postcosecha-reminder",
    plantId: PLANT_518,
    evalId: "15caja",
    subject: "15 días · Caja",
    body: "toca evaluarla hoy en 518. Se empacó el 30 de septiembre.",
    createdAt: MOCK_NOW - 3 * HOUR,
    read: false,
  },
  {
    id: "n4",
    kind: "plants-download",
    subject: "518",
    body: "tiene cambios en el servidor. Campo Pozo Manuel · Cuadro 10A · 2026.",
    createdAt: atFourForty(1),
    read: false,
  },
  {
    id: "n5",
    kind: "postcosecha-reminder",
    plantId: PLANT_CANDY_DREAMS,
    evalId: "30plastico",
    subject: "30 días · Liner",
    body: "toca evaluarla en Candy Dreams. Se empacó el 15 de septiembre.",
    createdAt: atFourForty(2),
    read: true,
  },
  {
    id: "n6",
    kind: "sync-reminder",
    subject: "Sincronización",
    body: "tienes 1 plantación con capturas sin enviar.",
    createdAt: MOCK_NOW - 4 * DAY,
    read: true,
  },
  {
    id: "n7",
    kind: "plants-download",
    subject: "Candy Dreams",
    body: "tiene cambios en el servidor. Campo Pozo Manuel · Cuadro 6A · 2026.",
    createdAt: MOCK_NOW - 8 * DAY,
    read: true,
  },
  {
    id: "n8",
    kind: "postcosecha-reminder",
    plantId: PLANT_518,
    evalId: "15plastico",
    subject: "15 días · Liner",
    body: "toca evaluarla en 518. Se empacó el 6 de septiembre.",
    createdAt: MOCK_NOW - 9 * DAY,
    read: true,
  },
  {
    id: "n9",
    kind: "sync-reminder",
    subject: "Sincronización",
    body: "tienes 3 plantaciones con capturas sin enviar.",
    createdAt: MOCK_NOW - 12 * DAY,
    read: true,
  },
];
