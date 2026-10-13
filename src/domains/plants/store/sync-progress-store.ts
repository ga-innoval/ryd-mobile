import { create } from "zustand";
import {
  progressFromReport,
  type PushAllReport,
  type SyncProgress,
  type SyncUnit,
} from "../lib/sync-progress";

/**
 * El avance de «sincronizar todo», mientras pasa.
 *
 * **Por qué un store y no la caché de mutations**, al revés que el resto del
 * estado de sincronización: TanStack Query no tiene canal de progreso —una
 * mutation está en vuelo o no—, y el aviso necesita saber por cuál plantación
 * va. Esto es exactamente lo que no se puede leer de ningún otro sitio, que es
 * la regla para merecer un store.
 *
 * **Sin persistir**: una tanda no sobrevive a cerrar la app, y al reabrir lo que
 * quedó sin mandar lo dicen los chips. Por eso tampoco importa AsyncStorage, y
 * el módulo se puede probar sin mocks nativos.
 */
type SyncProgressStore = {
  progress: SyncProgress;
  /**
   * El evaluador lo cerró.
   *
   * **Cerrar no borra el avance, lo esconde**, y eso no es capricho: mientras se
   * desvanece el aviso sigue pintando lo último que decía, y borrarlo lo dejaría
   * vacío a mitad de la animación. Guardar aquí ese «ya no se ve» evita tener
   * que copiar el contenido anterior en el componente —con un `setState` dentro
   * de un efecto, o leyendo un ref al pintar—, dos cosas que la configuración de
   * ESLint prohíbe con razón.
   */
  dismissed: boolean;
  /**
   * Un renglón por plantación y tipo, para la lista desplegable. Nace entera y
   * va cambiando de estado, así que el aviso no crece mientras sincroniza.
   */
  units: SyncUnit[];
  start: () => void;
  advance: (tick: { done: number; total: number; units: SyncUnit[] }) => void;
  finish: (report: PushAllReport) => void;
  /** La tanda no llegó a ningún sitio. */
  fail: (offline: boolean) => void;
  dismiss: () => void;
};

export const useSyncProgressStore = create<SyncProgressStore>()((set) => ({
  progress: { kind: "idle" },
  dismissed: false,
  units: [],

  start: () =>
    set({
      // Arranca en 0 de 0: el total real llega con el primer `advance`, en
      // cuanto `pushAll` sabe cuántas plantaciones tienen algo que mandar.
      progress: { kind: "running", done: 0, total: 0 },
      dismissed: false,
      units: [],
    }),

  advance: ({ done, total, units }) =>
    set({ progress: { kind: "running", done, total }, units }),

  finish: (report) => set({ progress: progressFromReport(report) }),

  fail: (offline) =>
    set((state) => ({
      progress: offline
        ? { kind: "offline" }
        : // Sin red se corta la tanda; con cualquier otro fallo se sigue, así
          // que lo que haya quedado es lo que se alcanzó a mandar.
          {
            kind: "partial",
            sincronizadas:
              state.progress.kind === "running" ? state.progress.done : 0,
            total: state.progress.kind === "running" ? state.progress.total : 0,
          },
    })),

  dismiss: () => set({ dismissed: true }),
}));
