import {
  notificationFromOs,
  osDateToMs,
  type OsNotification,
} from "../notification-from-os";

const os = (overrides: {
  data?: unknown;
  title?: string | null;
  body?: string | null;
  date?: number;
  identifier?: string;
}): OsNotification => ({
  date: overrides.date ?? 1_760_000_000_000,
  request: {
    identifier: overrides.identifier ?? "postcosecha:p1:15caja:2026-10-30",
    content: {
      title: overrides.title === undefined ? "Título" : overrides.title,
      body: overrides.body === undefined ? "Cuerpo" : overrides.body,
      data:
        "data" in overrides
          ? overrides.data
          : { plantId: "p1", evalId: "15caja" },
    },
  },
});

describe("notificationFromOs", () => {
  it("convierte un recordatorio de post-cosecha", () => {
    expect(notificationFromOs(os({}), 5)).toEqual({
      id: "postcosecha:p1:15caja:2026-10-30",
      kind: "postcosecha-reminder",
      subject: "Título",
      body: "Cuerpo",
      createdAt: 1_760_000_000_000,
      read: false,
      plantId: "p1",
      evalId: "15caja",
    });
  });

  // Llegar no es abrirlo: nace sin leer.
  it("nace sin leer", () => {
    expect(notificationFromOs(os({}), 5)?.read).toBe(false);
  });

  it("sin título ni cuerpo no revienta", () => {
    const item = notificationFromOs(os({ title: null, body: null }), 5);

    expect(item?.subject).toBe("Evaluación de post-cosecha");
    expect(item?.body).toBe("");
  });

  // Lo que la app no reconoce no entra: la bandeja no tiene dónde ponerlo.
  it.each([
    ["sin data", undefined],
    ["data vacío", {}],
    ["sin evaluación", { plantId: "p1" }],
  ])("%s no entra", (_, data) => {
    expect(notificationFromOs(os({ data }), 5)).toBeNull();
  });

  it("usa el identificador del sistema como el de la bandeja", () => {
    expect(notificationFromOs(os({ identifier: "dev-test:1" }), 5)?.id).toBe(
      "dev-test:1",
    );
  });
});

describe("osDateToMs", () => {
  it("deja los milisegundos como están", () => {
    expect(osDateToMs(1_760_000_000_000, 7)).toBe(1_760_000_000_000);
  });

  // Según plataforma `Notification.date` llega en segundos.
  it("convierte los segundos a milisegundos", () => {
    expect(osDateToMs(1_760_000_000, 7)).toBe(1_760_000_000_000);
  });

  it.each([[0], [-5], [NaN], [Infinity], ["x"], [undefined], [null]])(
    "%p cae en el respaldo",
    (value) => {
      expect(osDateToMs(value, 7)).toBe(7);
    },
  );
});
