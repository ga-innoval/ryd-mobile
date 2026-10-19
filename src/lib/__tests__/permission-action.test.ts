import { permissionAction } from "../permission-action";

describe("permissionAction", () => {
  it("con el permiso concedido no pide nada", () => {
    expect(permissionAction({ granted: true, canAskAgain: true })).toBe(
      "proceed",
    );
    // Android conserva `canAskAgain` en verdadero tras conceder.
    expect(permissionAction({ granted: true, canAskAgain: false })).toBe(
      "proceed",
    );
  });

  it("sin decidir, pregunta", () => {
    expect(permissionAction({ granted: false, canAskAgain: true })).toBe("ask");
  });

  // iOS no vuelve a mostrar el diálogo: pedirlo sería un botón muerto.
  it("negado para siempre, manda a Ajustes", () => {
    expect(permissionAction({ granted: false, canAskAgain: false })).toBe(
      "settings",
    );
  });
});
