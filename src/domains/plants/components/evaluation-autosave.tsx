import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { useQueryClient } from "@tanstack/react-query";
import { useFormContext, useWatch } from "react-hook-form";
import { toast } from "@/lib/toast";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import {
  saveRespuestaSecciones,
  useClearRespuestas,
  useRespuestas,
  useSaveRespuestas,
} from "../hooks/use-respuestas";
import { PLANTS_QUERY_KEY } from "../hooks/use-plants";
import { buildEvaluationFromRespuestas } from "../lib/build-evaluation-from-respuestas";
import { evaluationProgress } from "../lib/evaluation-progress";
import {
  EMPTY_FOTOS,
  useFotos,
  useRemoveFotos,
} from "../hooks/use-respuesta-fotos";
import { groupFotosByCategoria } from "../lib/group-fotos-by-categoria";
import {
  buildEvaluationDefaults,
  type EvaluationFormValues,
  type EvaluationSectionId,
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

  const db = useSQLiteContext();
  const queryClient = useQueryClient();
  const { data: respuestas } = useRespuestas(tratamientoId);
  const { mutate, isPending, isError } = useSaveRespuestas(tratamientoId);
  const { mutate: clearRespuestas } = useClearRespuestas(tratamientoId);
  const { mutate: removeFotos } = useRemoveFotos(tratamientoId);

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

  // Las fotografías no están en el formulario: viven en su tabla, así que el
  // avance las consulta aparte. El `useMemo` no es opcional — este componente
  // se re-renderiza en cada tecla y sin él se reagruparía en cada una.
  const { data: fotos } = useFotos(tratamientoId);
  const porCategoria = useMemo(
    () => groupFotosByCategoria(fotos ?? EMPTY_FOTOS),
    [fotos],
  );
  const progress = evaluationProgress(values, porCategoria);
  const setProgress = useEvaluationSaveStore((state) => state.setProgress);

  useEffect(() => {
    setProgress(progress);
  }, [progress, setProgress]);

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

  /**
   * Deja el tratamiento como si nadie lo hubiera tocado: borra sus filas de
   * `respuestas`, borra sus fotografías —filas y archivos— y vacía el
   * formulario. Lo confirma un diálogo en la cabecera; aquí ya no se pregunta.
   *
   * **Mover `written` no es cosmética, es lo que impide que el limpiado se
   * deshaga solo.** `saved` sale de `written ?? stored`, y `stored` viene de una
   * consulta que no se refresca al escribir, así que seguiría trayendo lo de
   * antes: el autoguardado compararía el formulario vacío contra ello, vería las
   * seis secciones cambiadas y dos segundos después **volvería a crear las filas
   * en blanco** que acabamos de borrar. Con la foto vacía puesta a mano no queda
   * nada pendiente y no se escribe nada.
   *
   * Va en el mismo manejador que el `reset` a propósito: React agrupa los dos,
   * así que no hay ni un render en que el formulario esté vacío y `saved` no.
   */
  const handleClear = useCallback(() => {
    const vacia = buildEvaluationDefaults();

    if (fotos && fotos.length > 0) {
      removeFotos(fotos.map((foto) => foto.clientId));
    }

    clearRespuestas();
    reset(vacia);
    setWritten(snapshotEvaluation(vacia));
  }, [fotos, removeFotos, clearRespuestas, reset]);

  // Sin `saved` no hay contra qué comparar y los dos botones no harían nada:
  // mejor apagados —que es lo que significa `null`— que mudos.
  useEffect(() => {
    setActions(saved ? { save: handleSave, clear: handleClear } : null);
  }, [setActions, saved, handleSave, handleClear]);

  // El fallo de escritura va antes que lo pendiente a propósito: tras un fallo
  // los cambios siguen sin guardar, y decir "Cambios por guardar" escondería que
  // la escritura ya se intentó y no salió.
  //
  // Los errores de captura **no entran aquí**: esto dice si el trabajo está
  // escrito, y meterlos tapaba el "Guardando…" justo cuando había algo
  // pendiente. De eso habla el botón flotante de la pantalla.
  const status: SaveStatus =
    isPending || confirming
      ? "saving"
      : isError
        ? "error"
        : pending.length > 0
          ? "pending"
          : written
            ? "saved"
            : "idle";

  useEffect(() => {
    setStatus(status);
  }, [status, setStatus]);

  /**
   * Lo que hay que escribir si la pantalla se cierra ahora mismo.
   *
   * En un ref y reasignado en cada render porque el vaciado corre en la
   * limpieza del efecto de desmontaje, que solo se registra una vez: con las
   * dependencias puestas se ejecutaría en cada cambio de `saved`, escribiendo
   * de más; sin ellas, se llevaría por delante una copia vieja de los valores.
   */
  const flush = useRef<() => void>(() => {});

  useEffect(() => {
    flush.current = () => {
      if (!saved) return;

      const current = getValues();
      const changed = changedSecciones(current, saved);
      if (changed.length === 0) return;

      // Directo al repositorio y no por la mutation: esto corre mientras el
      // componente se desmonta, y su mutation no llega viva al final. Por eso
      // la invalidación del listado hay que repetirla aquí a mano — y es justo
      // el caso que más importa, porque salir de la pantalla es volver a la
      // tarjeta que tiene que enterarse del error.
      //
      // El `catch` no es de adorno: sin él esto es una promesa sin manejar, así
      // que un fallo de escritura se quedaba en un warning de consola y el dato
      // se perdía en silencio —justo en el camino que corre cuando el evaluador
      // ya no está mirando esta pantalla—. El camino normal avisa con el
      // `onError` de la mutation; este tiene que avisar por su cuenta. El toast
      // es global, así que sale aunque la pantalla ya se haya ido.
      void saveRespuestaSecciones(db, tratamientoId, {
        values: current,
        secciones: changed,
      })
        .then(() =>
          queryClient.invalidateQueries({
            queryKey: PLANTS_QUERY_KEY,
            exact: true,
          }),
        )
        .catch((error: Error) =>
          toast.error({
            title: "No se pudo guardar",
            description: error.message,
          }),
        );
    };
  });

  // Al salir: se escribe lo que quede pendiente y se limpia la cabecera, que si
  // no heredaría el estado y las acciones de esta evaluación.
  //
  // Sin esto se perdía **lo último tecleado en los dos segundos antes de
  // salir**: el temporizador del autoguardado moría con el componente. Se veía
  // clarísimo con un aviso delante —sale a los 900 ms, así que daba tiempo de
  // leerlo y salir antes de que nada se hubiera escrito—, pero pasaba con
  // cualquier dato.
  useEffect(
    () => () => {
      flush.current();
      resetStore();
    },
    [resetStore],
  );

  return null;
}
