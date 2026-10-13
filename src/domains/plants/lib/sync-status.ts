/** En qué punto está el envío de lo que hay abierto, según la mutation. */
export type SendStatus = "idle" | "sending" | "sent" | "error";

/**
 * Lo que enseña el indicador de sincronización de la cabecera de captura.
 *
 * **Separado del de guardado a propósito.** Se probó con un solo indicador que
 * encadenara las dos cosas —«Guardando…» → «Guardado» → «Pendiente de enviar» →
 * …— y en la tablet no funcionó: parecen una tubería pero contestan preguntas
 * distintas —«¿está escrito en la tablet?» y «¿está en el servidor?»—, y además
 * se solapan, porque se puede teclear mientras algo sube. Ahora cada uno va
 * pegado a su botón y dice lo suyo.
 *
 * Son los mismos estados y las mismas palabras que el `SyncBlock` de la pantalla
 * principal, para que sincronizar signifique lo mismo en los dos sitios.
 */
export type ItemSyncStatus =
  /** No hay nada capturado todavía: no hay noticia que dar. */
  "idle" | "pending" | "syncing" | "synced" | "error" | "rejected";

/**
 * Lo que está pasando ahora gana a lo que pasó, y lo que hay que atender gana a
 * lo rutinario:
 *
 * - **`rejected` va antes que `pending`.** Es lo único de esta lista que el
 *   evaluador no puede resolver solo —hay que avisar a quien administra la
 *   plantación—, así que no puede quedar tapado por el aviso de siempre.
 * - **`pending` va antes que `synced`.** Un envío correcto deja su mutation en
 *   `success` durante minutos; si el evaluador captura algo nuevo en ese rato,
 *   hay trabajo sin mandar y el indicador seguiría diciendo «Sincronizado».
 * - **`captured === 0` calla.** Sin nada capturado, «Sincronizado» sonaría a que
 *   algo salió cuando no hay nada — el mismo criterio por el que el indicador de
 *   guardado no dice nada en una evaluación recién abierta.
 */
export function resolveSyncStatus({
  send,
  captured,
  pending,
  rejected,
}: {
  send: SendStatus;
  /** Filas capturadas, enviadas o no. */
  captured: number;
  /** Secciones y fotografías sin enviar. */
  pending: number;
  /** Las que el servidor rechazó y no se reintentan solas. */
  rejected: number;
}): ItemSyncStatus {
  if (send === "sending") return "syncing";
  if (send === "error") return "error";

  if (rejected > 0) return "rejected";
  if (pending > 0) return "pending";
  if (captured === 0) return "idle";

  return "synced";
}
