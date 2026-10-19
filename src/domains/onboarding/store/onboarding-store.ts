import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addCompleted,
  mergeCompletedIds,
  parseCompletedIds,
  removeCompleted,
} from "../lib/onboarding-completion";

/**
 * Quién ya completó el onboarding, persistido.
 *
 * **Una lista de ids de usuario y no una bandera**: la tablet puede compartirse,
 * y cada evaluador tiene que ver su primera vez. Va en Zustand con `AsyncStorage`
 * y no en SQLite, por lo mismo que la bandeja de notificaciones: es una lista
 * pequeña sin consultas, y una tabla traería una migración para guardar un puñado
 * de ids.
 *
 * `hydrated` no se persiste y existe porque AsyncStorage contesta tarde: hasta
 * entonces no se sabe quién completó qué, y decidir con la lista vacía enseñaría
 * el onboarding a quien ya lo hizo.
 */
type OnboardingStore = {
  completedUserIds: string[];
  hydrated: boolean;
  markCompleted: (userId: string) => void;
  /** Lo deja como si nunca lo hubiera visto. Es la herramienta de desarrollo. */
  reset: (userId: string) => void;
};

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      completedUserIds: [],
      hydrated: false,
      markCompleted: (userId) =>
        set((state) => {
          const completedUserIds = addCompleted(state.completedUserIds, userId);

          // Sin cambio no se crea otra lista: repintaría el candado de la app.
          return completedUserIds === state.completedUserIds
            ? state
            : { completedUserIds };
        }),
      reset: (userId) =>
        set((state) => {
          const completedUserIds = removeCompleted(
            state.completedUserIds,
            userId,
          );

          return completedUserIds === state.completedUserIds
            ? state
            : { completedUserIds };
        }),
    }),
    {
      name: "onboarding",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ completedUserIds: state.completedUserIds }),
      // La fusión por defecto pisa lo que ya hay en memoria con lo leído del
      // disco, que llega tarde.
      merge: (persisted, current) => ({
        ...current,
        completedUserIds: mergeCompletedIds(
          parseCompletedIds(
            (persisted as { completedUserIds?: unknown } | undefined)
              ?.completedUserIds,
          ),
          current.completedUserIds,
        ),
      }),
      // También si la lectura falla: quedarse esperando para siempre dejaría la
      // app en un spinner.
      onRehydrateStorage: () => () => {
        useOnboardingStore.setState({ hydrated: true });
      },
    },
  ),
);
