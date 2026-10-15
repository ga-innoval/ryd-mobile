import { create } from "zustand";

/**
 * Qué notificaciones marcó el evaluador como leídas en esta sesión. **Solo los
 * ids, no las notificaciones**: la lista viene de otro sitio —hoy un mock, mañana
 * lo derivado de SQLite— y lo único que no se puede derivar de ahí es qué se ha
 * mirado.
 *
 * Sin `persist`, a propósito: con datos de mentira no hay nada que recordar. El
 * día que sean reales sí hace falta —un aviso que reaparece como nuevo cada vez
 * que se abre la app deja de ser un aviso—, y entonces es `persist` +
 * `AsyncStorage` como `download-store`, con la forma ya hecha.
 */
type NotificationsReadStore = {
  readIds: ReadonlySet<string>;
  markRead: (id: string) => void;
  markAllRead: (ids: readonly string[]) => void;
};

export const useNotificationsReadStore = create<NotificationsReadStore>(
  (set) => ({
    readIds: new Set(),
    markRead: (id) =>
      set((state) =>
        // Sin cambio no se crea otro `Set`: la referencia nueva repintaría a
        // todos los que escuchan —la campana incluida— sin que cambie nada.
        state.readIds.has(id)
          ? state
          : { readIds: new Set(state.readIds).add(id) },
      ),
    markAllRead: (ids) =>
      set((state) => ({ readIds: new Set([...state.readIds, ...ids]) })),
  }),
);
