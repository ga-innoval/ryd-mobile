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
  /**
   * Deja a cero lo que hay abierto: borra sus respuestas, sus fotografías y
   * vacía el formulario. No es «descartar cambios» —eso volvía a lo último
   * guardado—, así que la cabecera lo confirma con un diálogo antes de llamarlo.
   *
   * **Qué es «lo que hay abierto» depende de quién registre la acción**: en
   * tratamiento es el tratamiento entero; en post-cosecha, una sola de las
   * cuatro evaluaciones. Por eso el texto del diálogo lo pone cada cabecera.
   */
  clear: () => void;
};

type EvaluationSaveStore = {
  status: SaveStatus;
  setStatus: (status: SaveStatus) => void;
  /**
   * Lo capturado de la evaluación abierta, de 0 a 1. Viaja por aquí por lo
   * mismo que el estado: la cabecera se pinta fuera del árbol de la pantalla y
   * no ve ni el formulario ni el store de fotografías.
   */
  progress: number;
  setProgress: (progress: number) => void;
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
  /**
   * Al salir de la evaluación, para que la cabecera no herede su estado.
   *
   * **Con dos pantallas de captura compartiendo este store, llamarlo al
   * desmontar deja de ser aseo y pasa a ser invariante**: si una se lo salta, la
   * otra abre heredando su «Guardado» y unas `actions` que apuntan a un cierre
   * muerto — pulsar Guardar llamaría a la mutation de un componente que ya no
   * existe.
   */
  reset: () => void;
};

/**
 * El puente entre el formulario y la cabecera.
 *
 * Existe porque la cabecera se pinta **fuera** del árbol de la pantalla —es el
 * `header` del navigator—, así que no ve el `FormProvider` y no puede preguntar
 * por sí misma si hay algo sin guardar. Es el mismo caso que el avance, que viaja
 * por aquí por lo mismo.
 *
 * Quien calcula el estado y hace el trabajo es el autoguardado que haya montado
 * —`EvaluationAutosave` en tratamiento, `PostcosechaAutosave` en post-cosecha—,
 * que sí vive dentro del formulario. Esto solo lleva y trae.
 *
 * **Sin identidad a propósito**: no guarda de quién es lo que cuenta porque solo
 * hay una pantalla de captura abierta a la vez, y quien la abre se presenta al
 * montarse y se despide con `reset()`. Meterle un id obligaría a que la cabecera
 * supiera cuál de las dos encuestas está mirando, que es justo lo que no
 * necesita saber.
 */
export const useEvaluationSaveStore = create<EvaluationSaveStore>()((set) => ({
  status: "idle",
  setStatus: (status) => set({ status }),
  progress: 0,
  setProgress: (progress) => set({ progress }),
  actions: null,
  setActions: (actions) => set({ actions }),
  reset: () => set({ status: "idle", progress: 0, actions: null }),
}));
