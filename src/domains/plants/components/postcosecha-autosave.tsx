import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { useQueryClient } from "@tanstack/react-query";
import { useFormContext, useWatch } from "react-hook-form";
import { toast } from "@/lib/toast";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import {
  savePostcosechaSecciones,
  usePostcosechaClear,
  usePostcosechaRespuestas,
  usePostcosechaSave,
} from "../hooks/use-postcosecha-respuestas";
import { PLANTS_QUERY_KEY } from "../hooks/use-plants";
import {
  EMPTY_POSTCOSECHA_FOTOS,
  usePostcosechaFotos,
  useRemovePostcosechaFotos,
} from "../hooks/use-postcosecha-fotos";
import { POSTCOSECHA_PHOTO_CATEGORIES } from "../lib/postcosecha-photo-categories";
import { buildPostcosechaFromRespuestas } from "../lib/build-postcosecha-from-respuestas";
import { postcosechaProgress } from "../lib/postcosecha-progress";
import {
  buildPostcosechaDefaults,
  type PostcosechaFormValues,
  type PostcosechaSectionId,
} from "../lib/postcosecha-schema";
import {
  changedSeccionesPostcosecha,
  mergePostcosechaSnapshot,
  snapshotPostcosecha,
  type PostcosechaSnapshot,
} from "../lib/postcosecha-snapshot";
import {
  useEvaluationSaveStore,
  type SaveStatus,
} from "../store/evaluation-save-store";

/** Lo mismo que en tratamiento, y por las mismas razones: ver
 *  `evaluation-autosave.tsx`, donde están medidas. */
const AUTOSAVE_QUIET_MS = 2_000;
const MANUAL_FEEDBACK_MS = 700;

/**
 * El guardado de una evaluación de post-cosecha: automático por sección, y a
 * mano desde los botones de la cabecera.
 *
 * **Hermano de `EvaluationAutosave`, no una generalización suya.** Lo único que
 * comparten es la coreografía —esperar a que el evaluador pare, comparar contra
 * lo último escrito, avisar a la cabecera—; todo lo demás cambia: otra tabla,
 * otro dueño, otros defaults, otro reparto del avance. Juntarlos en un
 * componente con seis parámetros haría más difícil de leer la parte delicada,
 * que es esta secuencia.
 *
 * **No pinta nada.** Mira el formulario entero con `useWatch`, así que el
 * re-render de cada tecla se queda aquí en vez de repintar las secciones, y lo
 * que hay que enseñar viaja a la cabecera por `evaluation-save-store` —que se
 * pinta fuera de este árbol y no ve el `FormProvider`—.
 *
 * **Quien lo monta le pone `key={`${plantId}:${evalId}`}`.** Saltar de chip no
 * desmonta la pantalla, así que sin esa `key` este componente sobreviviría al
 * salto con `written` lleno de la foto de la evaluación anterior mientras
 * `stored` vuelve a estar `undefined`: compararía el formulario ya vaciado
 * contra aquella foto y escribiría **la evaluación anterior dentro de la
 * nueva**. Con la `key`, el desmontaje vacía lo pendiente con su `plantId` y su
 * `evalId` ya capturados en su propio cierre.
 */
export function PostcosechaAutosave({
  plantId,
  evalId,
}: {
  plantId: string;
  evalId: string;
}) {
  const values = useWatch<PostcosechaFormValues>() as PostcosechaFormValues;
  const { getValues, reset } = useFormContext<PostcosechaFormValues>();
  const debounced = useDebouncedValue(values, AUTOSAVE_QUIET_MS);

  const db = useSQLiteContext();
  const queryClient = useQueryClient();
  const { data: respuestas } = usePostcosechaRespuestas(plantId, evalId);
  const { mutate, isPending, isError } = usePostcosechaSave(plantId, evalId);
  const { mutate: clearRespuestas } = usePostcosechaClear(plantId, evalId);
  const { mutate: removeFotos } = useRemovePostcosechaFotos(plantId, evalId);

  // Lo que hay en SQLite, y no lo que había en el formulario al montar: así da
  // igual si esto aparece antes o después de que la pantalla vuelque los
  // valores guardados. Sin esto, montarse primero haría que el volcado
  // pareciera una edición y reescribiera las dos secciones, devolviéndolas a la
  // cola del push.
  const stored = useMemo(
    () =>
      respuestas &&
      snapshotPostcosecha(buildPostcosechaFromRespuestas(respuestas)),
    [respuestas],
  );

  // Lo escrito desde entonces. Derivado en vez de copiado en un efecto: lo
  // único que lo cambia es guardar, que es un evento.
  const [written, setWritten] = useState<PostcosechaSnapshot | null>(null);
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

  const pending = saved ? changedSeccionesPostcosecha(values, saved) : [];

  const write = useCallback(
    (secciones: PostcosechaSectionId[], next: PostcosechaFormValues) => {
      if (!saved || secciones.length === 0) return;

      mutate(
        { values: next, secciones },
        {
          onSuccess: () =>
            setWritten(mergePostcosechaSnapshot(saved, next, secciones)),
        },
      );
    },
    [mutate, saved],
  );

  // El autoguardado. `debounced` solo se mueve cuando el evaluador para, así
  // que este efecto no corre por cada tecla.
  /**
   * **El primer instante en que se sabe qué hay en SQLite no es un instante
   * para escribir.** La pantalla vuelca ese contenido en el formulario desde su
   * propio efecto, y los efectos de este componente —que es hijo suyo— corren
   * antes que los del padre. Entre los dos instantes el formulario todavía está
   * en blanco, así que sin esta guarda el autoguardado compara el vacío contra
   * lo guardado, ve las secciones «cambiadas» y **escribe los valores en blanco
   * encima de lo capturado**.
   *
   * Que hoy no se vea es suerte: depende de cuál de las dos consultas responda
   * antes, y las dos leen de SQLite.
   *
   * Solo se salta esa primera vuelta. Lo que el evaluador hubiera tecleado
   * mientras el `SELECT` estaba en vuelo entra en la siguiente —dos segundos
   * después— o en el vaciado del desmontaje.
   */
  const hydrated = useRef(false);

  useEffect(() => {
    if (!saved) return;

    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }

    write(changedSeccionesPostcosecha(debounced, saved), debounced);
  }, [debounced, saved, write]);

  // Las fotografías no están en el formulario: viven en su tabla, así que el
  // avance las consulta aparte. El `useMemo` no es opcional — este componente se
  // re-renderiza en cada tecla y sin él se recontaría en cada una.
  const { data: fotos } = usePostcosechaFotos(plantId, evalId);
  const tomasConFoto = useMemo(() => {
    const todas = fotos ?? EMPTY_POSTCOSECHA_FOTOS;

    // Se recorre el catálogo y no las fotos, para que lo guardado bajo una
    // categoría retirada no siga contando.
    return POSTCOSECHA_PHOTO_CATEGORIES.filter((category) =>
      todas.some((foto) => foto.categoria === category.id),
    ).length;
  }, [fotos]);

  const progress = postcosechaProgress(values, tomasConFoto);
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

    // La rueda, un rato, aunque la escritura acabe antes: lo normal es pulsar
    // el botón cuando ya está todo guardado, y reconfirmar un estado no se ve.
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setConfirming(true);
    feedbackTimer.current = setTimeout(
      () => setConfirming(false),
      MANUAL_FEEDBACK_MS,
    );

    const current = getValues();
    const changed = changedSeccionesPostcosecha(current, saved);

    // Mover la foto a `written` es lo que enciende el "Guardado" de la cabecera
    // sin tocar SQLite. Es también lo que hace que abrir una evaluación y
    // pulsar Guardar no cree filas de la nada.
    if (changed.length === 0) {
      setWritten(saved);
      return;
    }

    write(changed, current);
  }, [saved, getValues, write]);

  /**
   * Deja **esta** evaluación como si nadie la hubiera tocado: borra sus filas,
   * borra sus fotografías —filas y archivos— y vacía el formulario. Las otras
   * tres no se tocan. Lo confirma un diálogo en la cabecera; aquí ya no se
   * pregunta.
   *
   * **Mover `written` no es cosmética, es lo que impide que el limpiado se
   * deshaga solo.** `saved` sale de `written ?? stored`, y `stored` viene de una
   * consulta que no se refresca al escribir, así que seguiría trayendo lo de
   * antes: el autoguardado compararía el formulario vacío contra ello, vería las
   * dos secciones cambiadas y dos segundos después **volvería a crear las filas
   * que acabamos de borrar**.
   *
   * Va en el mismo manejador que el `reset` a propósito: React agrupa los dos,
   * así que no hay ni un render en que el formulario esté vacío y `saved` no.
   */
  const handleClear = useCallback(() => {
    const vacia = buildPostcosechaDefaults();

    if (fotos && fotos.length > 0) {
      removeFotos(fotos.map((foto) => foto.clientId));
    }

    clearRespuestas();
    reset(vacia);
    setWritten(snapshotPostcosecha(vacia));
  }, [fotos, removeFotos, clearRespuestas, reset]);

  // Sin `saved` no hay contra qué comparar y los dos botones no harían nada:
  // mejor apagados —que es lo que significa `null`— que mudos.
  useEffect(() => {
    setActions(saved ? { save: handleSave, clear: handleClear } : null);
  }, [setActions, saved, handleSave, handleClear]);

  // El fallo de escritura va antes que lo pendiente a propósito: tras un fallo
  // los cambios siguen sin guardar, y decir "Cambios por guardar" escondería que
  // la escritura ya se intentó y no salió.
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
   * En un ref y reasignado en cada render porque el vaciado corre en la limpieza
   * del efecto de desmontaje, que solo se registra una vez: con las dependencias
   * puestas se ejecutaría en cada cambio de `saved`, escribiendo de más; sin
   * ellas, se llevaría por delante una copia vieja de los valores.
   */
  const flush = useRef<() => void>(() => {});

  useEffect(() => {
    flush.current = () => {
      if (!saved) return;

      const current = getValues();
      const changed = changedSeccionesPostcosecha(current, saved);
      if (changed.length === 0) return;

      // Directo al repositorio y no por la mutation: esto corre mientras el
      // componente se desmonta, y su mutation no llega viva al final. Por eso la
      // invalidación del listado hay que repetirla aquí a mano.
      //
      // El `catch` no es de adorno: sin él esto es una promesa sin manejar, así
      // que un fallo de escritura se quedaría en un warning de consola y el dato
      // se perdería en silencio, justo en el camino que corre cuando el
      // evaluador ya no está mirando. El toast es global, así que sale aunque la
      // pantalla ya se haya ido.
      void savePostcosechaSecciones(db, plantId, evalId, {
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

  // Al salir —o al saltar de evaluación, que aquí es lo mismo gracias a la
  // `key`— se escribe lo que quede pendiente y se limpia la cabecera, que si no
  // heredaría el estado y las acciones de esta evaluación.
  //
  // Sin esto se perdería lo último tecleado en los dos segundos antes de salir:
  // el temporizador del autoguardado muere con el componente.
  useEffect(
    () => () => {
      flush.current();
      resetStore();
    },
    [resetStore],
  );

  return null;
}
