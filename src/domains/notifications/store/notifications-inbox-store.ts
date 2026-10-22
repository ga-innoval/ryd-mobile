import { create } from "zustand";
import { persist } from "zustand/middleware";
import { userScopedJSONStorage } from "@/lib/user-storage";
import * as inbox from "../lib/notification-inbox";
import type { AppNotification } from "../types";

/**
 * La bandeja de notificaciones recibidas, persistida.
 *
 * **Zustand con `persist` y no una tabla de SQLite**: es una lista pequeña, con
 * tope, local al dispositivo y sin relaciones ni consultas —nunca se pregunta
 * nada de ella que no sea «dámela entera»—, así que una tabla traería migración y
 * repositorio para guardar un puñado de filas. Es el caso que CLAUDE.md ya
 * anticipaba: el día que las notificaciones fueran reales, el store necesitaba
 * `persist` + `AsyncStorage`, porque un aviso que reaparece como nuevo en cada
 * apertura deja de ser un aviso.
 *
 * Las reglas —duplicados, tope, leído— viven en `lib/notification-inbox.ts`, que
 * es puro y está probado; esto solo las cablea. Cada acción devuelve el mismo
 * estado cuando no cambia nada: una referencia nueva repintaría la campana y la
 * pantalla sin motivo.
 */
type InboxStore = {
  items: AppNotification[];
  addMany: (incoming: readonly AppNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

export const useNotificationsInbox = create<InboxStore>()(
  persist(
    (set) => ({
      items: [],
      addMany: (incoming) =>
        set((state) => {
          const items = inbox.addToInbox(state.items, incoming);

          return items === state.items ? state : { items };
        }),
      markRead: (id) =>
        set((state) => {
          const items = inbox.markRead(state.items, id);

          return items === state.items ? state : { items };
        }),
      markAllRead: () =>
        set((state) => {
          const items = inbox.markAllRead(state.items);

          return items === state.items ? state : { items };
        }),
    }),
    {
      name: "notifications-inbox",
      storage: userScopedJSONStorage(),
      partialize: (state) => ({ items: state.items }),
      // La fusión por defecto pisa lo que ya hay en memoria con lo leído del
      // disco, y el disco contesta tarde: un aviso que llega antes —el toque que
      // abre la app cerrada lo añade en el primer render— se perdería.
      merge: (persisted, current) => {
        const items = (persisted as { items?: unknown } | undefined)?.items;

        return Array.isArray(items)
          ? {
              ...current,
              items: inbox.mergeInboxes(items as AppNotification[], current.items),
            }
          : current;
      },
    },
  ),
);
