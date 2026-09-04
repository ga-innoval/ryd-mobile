import axios, { isAxiosError } from "axios";
import { env } from "./env";

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  401: "Las credenciales no coinciden. Intente de nuevo.",
  500: "Hubo un problema en el servidor. Intente de nuevo más tarde.",
};

export function formatAuthError(error: unknown): unknown {
  if (!isAxiosError(error)) {
    return error;
  }

  if (error.response) {
    const status = error.response.status;
    error.message =
      HTTP_ERROR_MESSAGES[status] || `Error con código de estatus ${status}.`;
  } else if (error.request) {
    error.message = "No se recibió respuesta. Revisa tu conexión a internet.";
  } else {
    error.message = "Error al configurar la solicitud.";
  }

  return error;
}

export const authClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

authClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(formatAuthError(error)),
);
