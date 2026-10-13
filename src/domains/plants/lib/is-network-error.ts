/**
 * Si el envío falló por **falta de conexión** y no porque el servidor
 * contestara algo malo.
 *
 * Es la misma distinción que ya hace `formatAuthError`: axios deja `request`
 * puesto y `response` vacío cuando la petición salió y nadie contestó —sin red,
 * o agotado el `timeout` de 10 s de `apiClient`, que en campo es el detector de
 * «sin señal» que hay—.
 *
 * **Sin `netinfo`**, a propósito: una librería nueva para contestar algo que el
 * propio fallo ya dice. Lo que no cubre es saber que no hay red *antes* de
 * intentarlo, y para el aviso que se enseña después da igual.
 */
export function isNetworkError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;

  const candidate = error as { request?: unknown; response?: unknown };

  return candidate.request !== undefined && candidate.response === undefined;
}
