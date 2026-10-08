import { syncEligibility } from "../sync-eligibility";

describe("syncEligibility", () => {
  it("sin nada pendiente no hay nada que mandar", () => {
    expect(syncEligibility({ pending: 0, hasError: false })).toEqual({
      kind: "nothing",
    });
  });

  it("con trabajo pendiente y sin errores, listo", () => {
    expect(syncEligibility({ pending: 3, hasError: false })).toEqual({
      kind: "ready",
      pending: 3,
    });
  });

  it("un dato imposible bloquea el envío", () => {
    expect(syncEligibility({ pending: 3, hasError: true })).toEqual({
      kind: "blocked",
    });
  });

  // El caso que invierte la intuición: el error solo bloquea si de verdad hay
  // algo esperando. Sobre una captura ya enviada —o rechazada y sin tocar— el
  // botón no se apaga con un motivo, simplemente no tiene trabajo.
  it("sin pendientes, el error no bloquea: no hay nada que bloquear", () => {
    expect(syncEligibility({ pending: 0, hasError: true })).toEqual({
      kind: "nothing",
    });
  });
});
