import { hasSyncedWork, syncEligibility } from "../sync-eligibility";

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

/**
 * El portero de limpiar, que es lo único de la cabecera que destruye trabajo.
 * Sin lápida de lo borrado-ya-enviado, limpiar algo que el servidor tiene lo
 * deja vivo en el reporte y muerto en la tablet.
 */
describe("hasSyncedWork", () => {
  it("nada capturado, nada que el servidor tenga", () => {
    expect(hasSyncedWork({ captured: 0, pending: 0, rejected: 0 })).toBe(false);
  });

  it("todo pendiente: no ha salido nada", () => {
    expect(hasSyncedWork({ captured: 6, pending: 6, rejected: 0 })).toBe(false);
  });

  // El caso que decidió la regla: el indicador aquí dice «Pendiente», no
  // «Sincronizado», y limpiar se llevaría por delante la que ya salió.
  it("una enviada y cinco pendientes ya cuenta", () => {
    expect(hasSyncedWork({ captured: 6, pending: 5, rejected: 0 })).toBe(true);
  });

  // `rejected_closed` es justo lo que el servidor NO aceptó: esa fila solo está
  // en la tablet, así que borrarla no descuadra nada.
  it("lo rechazado no cuenta como enviado", () => {
    expect(hasSyncedWork({ captured: 4, pending: 2, rejected: 2 })).toBe(false);
  });

  it("todo enviado", () => {
    expect(hasSyncedWork({ captured: 6, pending: 0, rejected: 0 })).toBe(true);
  });
});
