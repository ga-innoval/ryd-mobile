import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { useRespuestas, useSaveRespuestas } from "../hooks/use-respuestas";
import { buildEvaluationFromRespuestas } from "../lib/build-evaluation-from-respuestas";
import { evaluationErrors } from "../lib/evaluation-errors";
import type {
  EvaluationFormValues,
  EvaluationSectionId,
} from "../lib/evaluation-schema";
import {
  changedSecciones,
  mergeSnapshot,
  snapshotEvaluation,
  type EvaluationSnapshot,
} from "../lib/evaluation-snapshot";
import {
  useEvaluationSaveStore,
  type SaveStatus,
} from "../store/evaluation-save-store";

/**
 * Lo que se espera a que el evaluador pare antes de guardar.
 *
 * Dos segundos, probado en tablet. Con uno, contestar una pregunta llevaba más
 * que la espera y cada opción que se tocaba era su propia escritura; con cuatro,
 * la ronda entera cabía en un guardado pero el hueco sin escribir se hacía
 * grande. Dos agrupa la tanda sin alargar tanto lo que se perdería si la app
 * muriera justo ahí.
 *
 * El temporizador no tiene tope por arriba —se reinicia con cada cambio—, así
 * que escribir una observación larga sin una sola pausa de dos segundos aplaza
 * el guardado hasta que llegue.
 */
const AUTOSAVE_QUIET_MS = 2_000;

/**
 * Lo que la rueda se queda a la vista tras pulsar «Guardar».
 *
 * Escribir en SQLite local dura milisegundos: sin un mínimo, el botón no llega
 * a cambiar nada en pantalla. No es una espera artificial —el guardado ocurre
 * igual de rápido—, es que la respuesta se vea.
 */
const MANUAL_FEEDBACK_MS = 700;

/**
 * El guardado de la evaluación: automático por sección, y a mano desde los
 * botones de la cabecera.
 *
 * Lo automático es lo que protege el trabajo —en campo la app puede morir sin
 * aviso—, y el botón está porque ver "Guardado" después de pulsarlo es lo que
 * deja tranquilo a quien capturó media hora. No son dos caminos: el botón hace
 * lo mismo que el temporizador, solo que ya.
 *
 * **No pinta nada.** Mira el formulario entero con `useWatch`, así que el
 * re-render de cada tecla se queda aquí en vez de repintar las seis secciones,
 * y lo que hay que enseñar viaja a la cabecera por `evaluation-save-store` —que
 * se pinta fuera de este árbol y no ve el formulario—.
 *
 * **Guarda el formulario, no las fotografías**: esas siguen en un store sin
 * persistir, esperando la decisión de dónde acaban los archivos.
 */
export function EvaluationAutosave({
  tratamientoId,
}: {
  tratamientoId: string;
}) {
  const values = useWatch<EvaluationFormValues>() as EvaluationFormValues;
  const { getValues, reset } = useFormContext<EvaluationFormValues>();
  const debounced = useDebouncedValue(values, AUTOSAVE_QUIET_MS);

  const { data: respuestas } = useRespuestas(tratamientoId);
  const { mutate, isPending, isError } = useSaveRespuestas(tratamientoId);

  // Lo que hay en SQLite, y no lo que había en el formulario al montar: así da
  // igual si esto aparece antes o después de que la pantalla vuelque los
  // valores guardados. Sin esto, montarse primero haría que el volcado
  // pareciera una edición y reescribiera las seis secciones, devolviéndolas a
  // la cola del push.
  const stored = useMemo(
    () =>
      respuestas &&
      snapshotEvaluation(buildEvaluationFromRespuestas(respuestas)),
    [respuestas],
  );

  // Lo escrito desde entonces. Derivado en vez de copiado en un efecto: lo
  // único que lo cambia es guardar, que es un evento.
  const [written, setWritten] = useState<EvaluationSnapshot | null>(null);
  const saved = written ?? stored;

  // El mínimo visible del guardado a mano.
  const [confirming, setConfirming] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );

  const pending = saved ? changedSecciones(values, saved) : [];

  const write = useCallback(
    (secciones: EvaluationSectionId[], next: EvaluationFormValues) => {
      if (!saved || secciones.length === 0) return;

      mutate(
        { values: next, secciones },
        { onSuccess: () => setWritten(mergeSnapshot(saved, next, secciones)) },
      );
    },
    [mutate, saved],
  );

  // El autoguardado. `debounced` solo se mueve cuando el evaluador para, así
  // que este efecto no corre por cada tecla.
  useEffect(() => {
    if (!saved) return;

    write(changedSecciones(debounced, saved), debounced);
  }, [debounced, saved, write]);

  const setStatus = useEvaluationSaveStore((state) => state.setStatus);
  const setActions = useEvaluationSaveStore((state) => state.setActions);
  const resetStore = useEvaluationSaveStore((state) => state.reset);

  /** El botón de la cabecera. Escribe lo que falte, y si no falta nada lo dice
   *  igualmente: la pregunta que contesta es "¿está guardado?". */
  const handleSave = useCallback(() => {
    if (!saved) return;

    // La rueda, un rato, aunque la escritura acabe antes. Sin esto pulsar el
    // botón no movía nada en pantalla —lo normal es pulsarlo cuando ya está
    // todo guardado, y reconfirmar un estado no se ve— y parecía roto. Solo
    // hace falta aquí: por autoguardado la rueda ya lleva girando los dos
    // segundos de espera.
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setConfirming(true);
    feedbackTimer.current = setTimeout(
      () => setConfirming(false),
      MANUAL_FEEDBACK_MS,
    );

    const current = getValues();
    const changed = changedSecciones(current, saved);

    // Mover la foto a `written` es lo que enciende el "Guardado" de la cabecera
    // sin tocar SQLite.
    if (changed.length === 0) {
      setWritten(saved);
      return;
    }

    write(changed, current);
  }, [saved, getValues, write]);

  /** Vuelve a lo último guardado, que con el autoguardado es como mucho el
   *  último segundo de escritura. */
  const handleDiscard = useCallback(() => {
    if (!respuestas) return;

    reset(buildEvaluationFromRespuestas(respuestas));
  }, [respuestas, reset]);

  // Sin `saved` no hay contra qué comparar y los dos botones no harían nada:
  // mejor apagados —que es lo que significa `null`— que mudos.
  useEffect(() => {
    setActions(saved ? { save: handleSave, discard: handleDiscard } : null);
  }, [setActions, saved, handleSave, handleDiscard]);

  // Se mira sobre `debounced` y no sobre `values` porque esto describe lo
  // capturado, no lo que se está tecleando: con los valores en vivo, corregir un
  // peso encendería el rojo a media tecla. Los dos segundos de espera hacen aquí
  // de pausa de tecleo, sin un temporizador más.
  const hasErrors = evaluationErrors(debounced).length > 0;

  // El fallo de escritura va antes que lo pendiente a propósito: tras un fallo
  // los cambios siguen sin guardar, y decir "Cambios por guardar" escondería que
  // la escritura ya se intentó y no salió.
  //
  // Y "Error de captura" va después de lo pendiente pero antes de "Guardado":
  // habla de los datos, no de la escritura, así que decir solo "Guardado"
  // sonaría a que todo quedó bien.
  const status: SaveStatus =
    isPending || confirming
      ? "saving"
      : isError
        ? "error"
        : pending.length > 0
          ? "pending"
          : hasErrors
            ? "invalid"
            : written
              ? "saved"
              : "idle";

  useEffect(() => {
    setStatus(status);
  }, [status, setStatus]);

  // Al salir, para que la cabecera de la siguiente evaluación no herede ni este
  // estado ni estas acciones.
  useEffect(() => resetStore, [resetStore]);

  return null;
}
