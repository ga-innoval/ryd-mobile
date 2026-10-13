import { resolveSyncStatus } from "../sync-status";

const estado = (overrides = {}) =>
  resolveSyncStatus({
    send: "idle",
    captured: 0,
    pending: 0,
    rejected: 0,
    ...overrides,
  });

describe("resolveSyncStatus", () => {
  // El mismo criterio del indicador de guardado: sin nada capturado no hay
  // noticia que dar, y un «Sincronizado» de entrada sonaría a que algo salió.
  it("una captura en blanco no dice nada", () => {
    expect(estado()).toBe("idle");
  });

  it("con todo capturado y nada pendiente, está sincronizado", () => {
    expect(estado({ captured: 4 })).toBe("synced");
  });

  it("con trabajo sin mandar, lo dice", () => {
    expect(estado({ captured: 4, pending: 2 })).toBe("pending");
  });

  it("mientras sube, lo que pasa ahora gana", () => {
    expect(estado({ send: "sending", captured: 4, pending: 2 })).toBe(
      "syncing",
    );
    expect(estado({ send: "sending", captured: 4, rejected: 1 })).toBe(
      "syncing",
    );
  });

  it("un envío fallido se ve antes que lo que quedó pendiente", () => {
    expect(estado({ send: "error", captured: 4, pending: 2 })).toBe("error");
  });

  // La mutation se queda en `success` minutos, así que sin esta regla un
  // «Sincronizado» sobreviviría a que el evaluador capturara algo nuevo.
  it("capturar algo nuevo apaga el «Sincronizado»", () => {
    expect(estado({ send: "sent", captured: 4 })).toBe("synced");
    expect(estado({ send: "sent", captured: 5, pending: 1 })).toBe("pending");
  });

  // Lo único que el evaluador no puede resolver solo.
  it("un rechazo no queda tapado por el aviso rutinario", () => {
    expect(estado({ captured: 4, rejected: 1, pending: 3 })).toBe("rejected");
    expect(estado({ send: "sent", captured: 4, rejected: 1 })).toBe("rejected");
  });
});
