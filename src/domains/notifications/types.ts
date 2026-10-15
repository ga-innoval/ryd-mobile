/**
 * Los tres avisos que la app va a dar, y nada más: cada tipo nuevo es una
 * entrada aquí y una en `NOTIFICATION_CATEGORY`.
 *
 * - `plants-download`: se detectaron plantaciones nuevas o cambios en las que ya
 *   se tienen, listos para descargar.
 * - `postcosecha-reminder`: una post-cosecha empacada ya toca evaluarse.
 * - `sync-reminder`: hay plantaciones con capturas sin enviar.
 */
export type NotificationKind =
  | "plants-download"
  | "postcosecha-reminder"
  | "sync-reminder";

/** Los chips de la pantalla. `todas` y `sin-leer` cortan por estado; los otros
 *  dos, por la categoría del tipo. */
export type NotificationFilter =
  | "todas"
  | "sin-leer"
  | "alertas"
  | "sincronizacion";

export type NotificationCategory = Exclude<
  NotificationFilter,
  "todas" | "sin-leer"
>;

type NotificationBase = {
  id: string;
  /** Lo que va en negritas al inicio de la frase: la plantación, la evaluación. */
  subject: string;
  /** El resto de la frase. */
  body: string;
  /** Cuándo ocurrió, en milisegundos desde la época. */
  createdAt: number;
  /**
   * Si ya está leída. **La resuelve `useNotifications`**: la fuente trae su
   * valor de origen y el hook le suma lo que el evaluador marcó en esta sesión.
   */
  read: boolean;
};

/**
 * **Unión discriminada a propósito**: el recordatorio de post-cosecha es el
 * único que lleva a una evaluación concreta, así que es el único que carga su
 * `plantId` y `evalId`. Con campos opcionales en todos, un recordatorio sin
 * destino compilaría, y tocarlo no llevaría a ningún sitio.
 */
export type AppNotification = NotificationBase &
  (
    | { kind: "plants-download" | "sync-reminder" }
    | { kind: "postcosecha-reminder"; plantId: string; evalId: string }
  );
