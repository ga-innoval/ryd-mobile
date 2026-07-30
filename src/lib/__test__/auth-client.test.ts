import { AxiosError } from "axios";
import { formatAuthError } from "../auth-client";

function buildAxiosError(overrides: Partial<AxiosError>): AxiosError {
  const error = new AxiosError("mensaje original");
  Object.assign(error, overrides);
  return error;
}

describe("formatAuthError()", () => {
  it("returns custom message for status 401", () => {
    const error = buildAxiosError({
      response: { status: 401 } as AxiosError["response"],
    });

    const result = formatAuthError(error) as AxiosError;

    expect(result.message).toBe(
      "Las credenciales no coinciden. Intente de nuevo.",
    );
  });

  it("returns custom message for status 500", () => {
    const error = buildAxiosError({
      response: { status: 500 } as AxiosError["response"],
    });

    const result = formatAuthError(error) as AxiosError;

    expect(result.message).toBe(
      "Hubo un problema en el servidor. Intente de nuevo más tarde.",
    );
  });

  it("returns generic message for unmapped status", () => {
    const error = buildAxiosError({
      response: { status: 403 } as AxiosError["response"],
    });

    const result = formatAuthError(error) as AxiosError;

    expect(result.message).toBe("Error con código de estatus 403.");
  });

  it("returns custom message for successful request but no response", () => {
    const error = buildAxiosError({
      response: undefined,
      request: {},
    });

    const result = formatAuthError(error) as AxiosError;

    expect(result.message).toBe(
      "No se recibió respuesta. Revisa tu conexión a internet.",
    );
  });

  it("returns custom message for unsuccessful request", () => {
    const error = buildAxiosError({
      response: undefined,
      request: undefined,
    });

    const result = formatAuthError(error) as AxiosError;

    expect(result.message).toBe("Error al configurar la solicitud.");
  });

  it("returns original error message if no AxiosError", () => {
    const errorGenerico = new Error("algo no relacionado a axios");

    const result = formatAuthError(errorGenerico);

    expect(result).toBe(errorGenerico);
    expect((result as Error).message).toBe("algo no relacionado a axios");
  });
});
