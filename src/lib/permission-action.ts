/** Lo que un sistema operativo cuenta de un permiso, sin importar cuál sea. */
export type PermissionStatus = {
  granted: boolean;
  /** Falso cuando el sistema ya no deja volver a preguntar: lo negó el usuario. */
  canAskAgain: boolean;
};

/** Qué hace un botón de «Permitir …» con el permiso tal como está. */
export type PermissionAction =
  /** Ya lo tiene: no hay nada que pedir. */
  | "proceed"
  /** Sin decidir: el sistema todavía puede preguntar. */
  | "ask"
  /** Negado para siempre: solo se cambia desde Ajustes. */
  | "settings";

/**
 * Decide qué hacer al pulsar «Permitir».
 *
 * **`settings` existe porque iOS pregunta una sola vez.** Con el permiso ya
 * negado, pedirlo no muestra nada y el botón quedaría muerto: la única salida es
 * llevar al usuario a Ajustes. Es una función aparte, y no un `if` en la
 * pantalla, para fijar esa distinción con un test: perderla deja un botón que
 * promete algo que no hace.
 */
export function permissionAction(status: PermissionStatus): PermissionAction {
  if (status.granted) return "proceed";

  return status.canAskAgain ? "ask" : "settings";
}
