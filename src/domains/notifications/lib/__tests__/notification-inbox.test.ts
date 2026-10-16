import type { AppNotification } from "../../types";
import {
  addToInbox,
  markAllRead,
  markRead,
  MAX_INBOX,
  mergeInboxes,
} from "../notification-inbox";

const note = (
  id: string,
  createdAt = 0,
  read = false,
): AppNotification => ({
  id,
  kind: "sync-reminder",
  subject: "s",
  body: "b",
  createdAt,
  read,
});

const ids = (items: AppNotification[]) => items.map((item) => item.id);

describe("addToInbox", () => {
  it("deja lo más nuevo primero", () => {
    const inbox = addToInbox([], [note("viejo", 1), note("nuevo", 3)]);

    expect(ids(inbox)).toEqual(["nuevo", "viejo"]);
  });

  it("no duplica un aviso que ya está", () => {
    const first = addToInbox([], [note("a", 1)]);

    expect(ids(addToInbox(first, [note("a", 1)]))).toEqual(["a"]);
  });

  // Llega por varios caminos —oyente, barrido de presentadas, toque—: el último
  // no puede devolver a «sin leer» lo que ya se abrió.
  it("lo que ya estaba leído no vuelve a sin leer", () => {
    const inbox = [note("a", 1, true)];

    const next = addToInbox(inbox, [note("a", 1, false)]);

    expect(next[0].read).toBe(true);
  });

  it("sin nada nuevo devuelve la misma lista", () => {
    const inbox = [note("a", 1)];

    expect(addToInbox(inbox, [note("a", 1)])).toBe(inbox);
  });

  it("no pasa del tope y se queda con lo más reciente", () => {
    const incoming = Array.from({ length: MAX_INBOX + 25 }, (_, i) =>
      note(`n${i}`, i),
    );

    const inbox = addToInbox([], incoming);

    expect(inbox).toHaveLength(MAX_INBOX);
    expect(inbox[0].id).toBe(`n${MAX_INBOX + 24}`);
    expect(inbox.at(-1)?.id).toBe("n25");
  });

  it("no muta la lista que recibe", () => {
    const inbox = [note("a", 1)];
    addToInbox(inbox, [note("b", 2)]);

    expect(ids(inbox)).toEqual(["a"]);
  });
});

describe("markRead / markAllRead", () => {
  it("marca solo el pedido", () => {
    const inbox = markRead([note("a"), note("b")], "a");

    expect(inbox.map((item) => item.read)).toEqual([true, false]);
  });

  // Una referencia nueva repintaría la campana y la pantalla sin que cambie nada.
  it("marcar lo ya leído, o lo que no existe, no cambia la referencia", () => {
    const inbox = [note("a", 0, true)];

    expect(markRead(inbox, "a")).toBe(inbox);
    expect(markRead(inbox, "no-existe")).toBe(inbox);
  });

  it("marca todas", () => {
    const inbox = markAllRead([note("a"), note("b", 0, true), note("c")]);

    expect(inbox.every((item) => item.read)).toBe(true);
  });

  it("si ya están todas leídas no cambia la referencia", () => {
    const inbox = [note("a", 0, true)];

    expect(markAllRead(inbox)).toBe(inbox);
  });
});

describe("mergeInboxes", () => {
  // El toque que abre la app cerrada añade su aviso antes de que AsyncStorage
  // conteste; lo leído del disco no puede llevárselo por delante.
  it("junta lo del disco con lo que ya llegó mientras se leía", () => {
    const merged = mergeInboxes([note("disco", 1)], [note("llegado", 2)]);

    expect(ids(merged)).toEqual(["llegado", "disco"]);
  });

  it("si está en los dos gana lo que había en memoria", () => {
    const merged = mergeInboxes([note("a", 1, false)], [note("a", 1, true)]);

    expect(merged[0].read).toBe(true);
  });
});
