import type { AppNotification, NotificationKind } from "../../types";
import {
  countByFilter,
  filterNotifications,
  unreadCount,
} from "../notification-filters";

const note = (
  id: string,
  kind: NotificationKind,
  read: boolean,
): AppNotification => {
  const base = { id, subject: "s", body: "b", createdAt: 0, read };

  return kind === "postcosecha-reminder"
    ? { ...base, kind, plantId: "p1", evalId: "15caja" }
    : { ...base, kind };
};

const SAMPLE = [
  note("a", "plants-download", false),
  note("b", "sync-reminder", true),
  note("c", "postcosecha-reminder", false),
  note("d", "postcosecha-reminder", true),
];

const ids = (items: AppNotification[]) => items.map((item) => item.id);

describe("filterNotifications", () => {
  it("todas no filtra", () => {
    expect(ids(filterNotifications(SAMPLE, "todas"))).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("sin leer corta por estado", () => {
    expect(ids(filterNotifications(SAMPLE, "sin-leer"))).toEqual(["a", "c"]);
  });

  it("los dos chips de categoría cortan por tipo", () => {
    expect(ids(filterNotifications(SAMPLE, "alertas"))).toEqual(["c", "d"]);
    expect(ids(filterNotifications(SAMPLE, "sincronizacion"))).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("countByFilter", () => {
  // El número del chip y la lista que sale al pulsarlo salen de la misma
  // función: aquí se comprueba que no puedan separarse.
  it("cada conteo es el largo de su lista", () => {
    const counts = countByFilter(SAMPLE);

    expect(counts).toEqual({
      todas: 4,
      "sin-leer": 2,
      alertas: 2,
      sincronizacion: 2,
    });
  });

  it("sin notificaciones, todo en cero", () => {
    expect(countByFilter([])).toEqual({
      todas: 0,
      "sin-leer": 0,
      alertas: 0,
      sincronizacion: 0,
    });
  });
});

describe("unreadCount", () => {
  it("cuenta las que no están leídas", () => {
    expect(unreadCount(SAMPLE)).toBe(2);
  });
});
