/**
 * Si lo que hay capturado se puede mandar ya.
 *
 * Son dos preguntas que hasta ahora vivían separadas —¿queda algo sin enviar?
 * (`syncStatus`) y ¿hay un dato imposible? (`hasError`)—, y ninguna de las dos
 * sola decide si el botón se enciende. Las dos marcas están **guardadas por
 * fila**, escritas por el propio guardado, así que preguntarlas es SQL y no abre
 * ningún payload.
 */
export type SyncEligibility =
  /** Nada que mandar: o nunca se capturó, o ya salió todo. */
  | { kind: "nothing" }
  /**
   * Hay trabajo sin enviar, pero trae un dato que no puede ser cierto.
   *
   * Un error no impide guardar —SQLite es la libreta del evaluador y ahí cabe
   * todo—; lo que impide es dar la captura por terminada y mandarla. Mandarlo
   * metería el imposible en el almacén analítico, y el servidor no rechaza por
   * contenido a propósito, así que el único sitio donde se puede parar es aquí.
   */
  | { kind: "blocked" }
  /** Listo para salir, con cuántas filas esperan. */
  | { kind: "ready"; pending: number };

/**
 * **El orden importa: «nada» gana a «bloqueado».** Un error sobre algo que ya
 * salió —o que el servidor rechazó y nadie ha vuelto a tocar— no es un
 * impedimento para enviar: no hay nada que enviar. Apagar el botón con un motivo
 * en ese caso dejaría al evaluador buscando qué arreglar para una acción que de
 * todas formas no iba a hacer nada.
 *
 * No devuelve el texto del motivo. Lo pone quien pinta, porque no es el mismo en
 * las dos pantallas: en tratamiento el botón flotante lleva hasta la sección que
 * falla, y en post-cosecha no hay tal botón, así que el motivo tiene que
 * nombrarla.
 */
export function syncEligibility({
  pending,
  hasError,
}: {
  pending: number;
  hasError: boolean;
}): SyncEligibility {
  if (pending <= 0) return { kind: "nothing" };
  if (hasError) return { kind: "blocked" };

  return { kind: "ready", pending };
}
