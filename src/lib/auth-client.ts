import axios, { isAxiosError } from "axios";
import { app } from "./app-metadata";

export const authClient = axios.create({
  baseURL: app.apiBaseUrl,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  401: "Las credenciales no coinciden. Intente de nuevo.",
  500: "Hubo un problema en el servidor. Intente de nuevo más tarde.",
};

authClient.interceptors.response.use(
  (response) => response, // Pass successful responses straight through
  (error) => {
    if (!isAxiosError(error)) {
      return Promise.reject(error);
    }
    if (error.response) {
      const status = error.response.status;
      // Override the default message with your custom dictionary text
      error.message =
        HTTP_ERROR_MESSAGES[status] || `Error con código de estatus ${status}.`;
    } else if (error.request) {
      // The request was made but no response was received
      error.message = "No se recibió respuesta. Revisa tu conexión a internet.";
    } else {
      // Something went wrong setting up the request
      error.message = "Error al configurar la solicitud.";
    }

    // Always return a rejected promise to propagate the modified error to try/catch blocks
    return Promise.reject(error);
  },
);
