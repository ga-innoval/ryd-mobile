import { isNetworkError } from "../is-network-error";

describe("isNetworkError", () => {
  // Salió la petición y no contestó nadie: sin red, o agotado el timeout.
  it("una petición sin respuesta es falta de conexión", () => {
    expect(isNetworkError({ request: {}, response: undefined })).toBe(true);
  });

  it("un error del servidor no lo es: alguien contestó", () => {
    expect(isNetworkError({ request: {}, response: { status: 500 } })).toBe(
      false,
    );
  });

  it("lo que ni siquiera llegó a salir tampoco lo es", () => {
    expect(isNetworkError({})).toBe(false);
    expect(isNetworkError(new Error("boom"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError("algo")).toBe(false);
  });
});
