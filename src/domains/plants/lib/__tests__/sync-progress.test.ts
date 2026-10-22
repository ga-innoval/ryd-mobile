import { progressFromReport, syncDialogView } from "../sync-progress";

const estado = (overrides = {}) =>
  syncDialogView({ kind: "running", done: 0, total: 1, ...overrides });

describe("progressFromReport con rechazos", () => {
  it("con la cola vacía y algo rechazado no es «nada»: es un rechazo", () => {
    expect(
      progressFromReport({
        plantaciones: 0,
        sincronizadas: 0,
        bloqueadas: 0,
        rechazadas: 2,
      }),
    ).toEqual({
      kind: "rejected",
      rechazadas: 2,
      sincronizadas: 0,
      total: 0,
    });
  });

  it("lo que falta explicado por rechazos no ofrece reintentar", () => {
    const progress = progressFromReport({
      plantaciones: 1,
      sincronizadas: 0,
      bloqueadas: 0,
      rechazadas: 1,
    });

    expect(syncDialogView(progress)).toMatchObject({
      title: "Sincronización rechazada",
      retry: false,
    });
  });

  it("si falta más de lo rechazado sigue siendo parcial, con reintento", () => {
    expect(
      syncDialogView(
        progressFromReport({
          plantaciones: 3,
          sincronizadas: 1,
          bloqueadas: 0,
          rechazadas: 1,
        }),
      ),
    ).toMatchObject({ retry: true });
  });

  it("sin nada ni rechazado no hubo tanda", () => {
    expect(
      progressFromReport({
        plantaciones: 0,
        sincronizadas: 0,
        bloqueadas: 0,
        rechazadas: 0,
      }),
    ).toEqual({ kind: "idle" });
  });
});

describe("syncDialogView", () => {
  it("sin sincronización en marcha no hay diálogo", () => {
    expect(syncDialogView({ kind: "idle" })).toBeNull();
  });

  // Por cuál va lo dice la lista, que está justo debajo; repetirlo arriba sería
  // contarlo dos veces.
  it("mientras sincroniza nombra el total, no por cuál va", () => {
    expect(
      syncDialogView({ kind: "running", done: 3, total: 10 }),
    ).toMatchObject({ title: "Sincronizando 10 plantaciones", percent: 30 });
  });

  // **Salir no detiene nada**: decir «Cerrar» prometería que algo se detiene.
  it("mientras sincroniza, salir es apartarse", () => {
    expect(estado()?.dismissLabel).toBe("Seguir en segundo plano");
    expect(syncDialogView({ kind: "done", total: 2 })?.dismissLabel).toBe(
      "Cerrar",
    );
  });

  it("al terminar bien lo dice en su número", () => {
    expect(syncDialogView({ kind: "done", total: 10 })).toMatchObject({
      tone: "primary",
      title: "10 plantaciones sincronizadas",
      percent: 100,
      retry: false,
    });
  });

  it("una sola plantación se dice en singular", () => {
    expect(syncDialogView({ kind: "done", total: 1 })?.title).toBe(
      "1 plantación sincronizada",
    );
  });

  // Lo que el usuario quería ver: que algo se quedó sin mandar, incluido lo
  // rechazado por encuesta cerrada.
  it("a medias ofrece reintentar y remite a la tarjeta", () => {
    expect(
      syncDialogView({ kind: "partial", sincronizadas: 8, total: 10 }),
    ).toMatchObject({
      tone: "warn",
      title: "8 de 10 sincronizadas",
      detail: "Lo que falta sigue marcado en su tarjeta.",
      percent: 80,
      retry: true,
    });
  });

  // Sin barra: no es que saliera poco, es que no empezó.
  it("sin conexión no pinta barra y no ofrece reintentar", () => {
    expect(syncDialogView({ kind: "offline" })).toMatchObject({
      tone: "warn",
      title: "Sin conexión",
      percent: null,
      retry: false,
    });
  });
});
