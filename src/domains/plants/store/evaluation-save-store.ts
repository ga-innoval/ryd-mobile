import { create } from "zustand";

/**
 * En qué punto está el guardado de la evaluación abierta.
 *
 * `idle` es una evaluación que nadie ha tocado todavía: ahí la cabecera no dice
 * nada, porque no hay noticia que dar.
 *
 * `pending` —hay cambios y el temporizador corre— y `saving` —ya escribiendo—
 * se distinguen aquí pero **se enseñan igual**, los dos como "Guardando…". La
 * separación la usa la cabecera para decidir qué bloquear: solo la escritura de
 * verdad apaga los botones.
 * **Aquí solo se habla de la escritura.** Que lo capturado tenga un dato
 * imposible no es un estado de guardado y no entra: lo enseña el botón flotante
 * de la pantalla. Mezclarlo tapaba el "Guardando…" justo cuando había algo sin
 * escribir, que es cuando más falta hace verlo.
 */
export type SaveStatus =
  "idle" | "pending" | "saving" | "saved" | "error" | "invalid";

/** Lo que hacen los dos botones de la cabecera. */
export type EvaluationSaveActions = {
  save: () => void;
  discard: () => void;
};

type EvaluationSaveStore = {
  status: SaveStatus;
  setStatus: (status: SaveStatus) => void;
  /**
   * Las registra `EvaluationAutosave` al montarse, y son `null` mientras no haya
   * una evaluación abierta —con la cabecera montada y la pantalla todavía
   * cargando, por ejemplo—, que es lo que apaga los botones.
   *
   * Van como funciones y no como una señal que un efecto atienda porque pulsar
   * un botón es un evento: pasando por un efecto, el guardado a mano tendría
   * que cambiar estado en medio de un render.
   */
  actions: EvaluationSaveActions | null;
  setActions: (actions: EvaluationSaveActions | null) => void;
  /** Al salir de la evaluación, para que la cabecera no herede su estado. */
  reset: () => void;
};

/**
 * El puente entre el formulario y la cabecera.
 *
 * Existe porque la cabecera se pinta **fuera** del árbol de la pantalla —es el
 * `header` del navigator—, así que no ve el `FormProvider` y no puede preguntar
 * por sí misma si hay algo sin guardar. Mismo motivo que `photos-store`, que
 * también lo leen dos sitios que no comparten árbol.
 *
 * Quien calcula el estado y hace el trabajo es `EvaluationAutosave`, que sí
 * vive dentro del formulario. Esto solo lleva y trae.
 */
export const useEvaluationSaveStore = create<EvaluationSaveStore>()((set) => ({
  status: "idle",
  setStatus: (status) => set({ status }),
  actions: null,
  setActions: (actions) => set({ actions }),
  reset: () => set({ status: "idle", actions: null }),
}));
