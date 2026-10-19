import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { BrushCleaningIcon, LoaderCircleIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { StatusDot } from "@/domains/plants/components/status-dot";
import { SyncButton } from "@/domains/plants/components/sync-button";
import type { ItemSyncStatus } from "@/domains/plants/lib/sync-status";
import type { SyncEligibility } from "@/domains/plants/lib/sync-eligibility";
import type { SaveStatus } from "@/domains/plants/store/evaluation-save-store";

/**
 * Lo que comparten las dos cabeceras de captura —tratamiento y post-cosecha—:
 * decir si el trabajo está escrito, decir si está en el servidor, dejar
 * limpiarlo y dejar mandarlo.
 *
 * **Dos indicadores y no uno.** Se probó encadenándolos en una sola línea
 * —«Guardando…» → «Guardado» → «Pendiente de enviar» → …— y en la tablet no
 * funcionó: parecen una tubería pero contestan preguntas distintas, «¿está
 * escrito aquí?» y «¿está allá?», y además se solapan, porque se puede teclear
 * mientras algo sube. Cada uno va pegado a su botón.
 *
 * Presentacional a propósito: el estado ya resuelto y los `onPress` llegan por
 * props, y cada cabecera los compone por su cuenta.
 */

/**
 * Qué enseña cada estado del guardado. Sin `dotCn` es la rueda girando.
 *
 * **`pending` y `saving` se ven igual a propósito.** Son distintos por dentro
 * —uno espera a que el evaluador pare de teclear, el otro ya está escribiendo—,
 * pero eso al evaluador no le sirve de nada: la escritura en SQLite dura
 * milisegundos, así que un indicador atado solo a ella no llegaba ni a
 * dibujarse. Juntos, la rueda gira desde el primer cambio y se queda hasta que
 * termina. Y así desaparece el «Cambios por guardar», que avisaba de un problema
 * que se arregla solo.
 */
const STATUS_VIEW: Partial<
  Record<SaveStatus, { text: string; dotCn?: string }>
> = {
  // Sin `idle`: mientras SQLite no conteste qué hay capturado, decir cualquier
  // cosa sería arriesgarse a desmentirla un instante después.
  empty: { text: "Sin datos", dotCn: "bg-primary-foreground/40" },
  pending: { text: "Guardando…" },
  saving: { text: "Guardando…" },
  saved: { text: "Guardado", dotCn: "bg-leaf" },
  error: { text: "No se pudo guardar", dotCn: "bg-destructive" },
};

/**
 * Qué enseña cada estado de la sincronización.
 *
 * **Las mismas palabras y los mismos colores que el `SyncBlock` de la pantalla
 * principal**, para que sincronizar signifique lo mismo en los dos sitios. Son
 * dos tablas y no una compartida porque los juegos de estados no coinciden —allí
 * existe «Sin sincronizar» y aquí «sin nada capturado»—; si algún día coinciden,
 * esto es lo que hay que juntar.
 */
const SYNC_VIEW: Partial<
  Record<ItemSyncStatus, { text: string; dotCn: string; animated?: boolean }>
> = {
  pending: {
    text: "Sinc. pendiente",
    dotCn: "bg-orange-400",
    animated: true,
  },
  syncing: {
    text: "Sincronizando...",
    dotCn: "bg-blue-400",
    animated: true,
  },
  synced: { text: "Sincronizado", dotCn: "bg-leaf" },
  error: { text: "Error de sincronización", dotCn: "bg-destructive" },
  rejected: { text: "Sincronización rechazada", dotCn: "bg-destructive" },
};

/**
 * La rueda que gira mientras dura la escritura.
 *
 * El estilo animado va en el `Animated.View` y el color en el `Icon` de
 * dentro: envolver el propio `Icon` con `createAnimatedComponent` hace que
 * Reanimated y NativeWind se disputen la prop `style`, y como esta rueda para
 * en un ángulo cualquiera, el icono desaparecería al detenerse.
 */
function SavingSpinner() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Icon
        as={LoaderCircleIcon}
        size={16}
        className="text-primary-foreground/75"
      />
    </Animated.View>
  );
}

/**
 * Si se está guardando o si ya quedó.
 *
 * Sin caja propia, pegado a los botones de limpiar y guardar: con fondo
 * parecería otro botón. Y con la evaluación recién abierta no dice nada — no
 * hay noticia que dar y un «Guardado» de entrada sería mentira.
 */
export function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  const view = STATUS_VIEW[status];
  if (!view) return null;

  return (
    <View
      className="flex-row items-center gap-2"
      role="status"
      aria-live="polite"
    >
      {view.dotCn ? (
        <View className={cn("size-2 rounded-full", view.dotCn)} />
      ) : (
        <SavingSpinner />
      )}
      <Text className="text-primary-foreground/85 text-sm font-medium">
        {view.text}
      </Text>
    </View>
  );
}

/**
 * Si lo capturado está en el servidor, pegado a su propio botón.
 *
 * Usa el `StatusDot` del listado y no un punto propio: es el que sabe pulsar
 * mientras algo está en marcha, y así los dos sitios donde se habla de
 * sincronizar se ven igual.
 */
export function SyncStatusIndicator({ status }: { status: ItemSyncStatus }) {
  const view = SYNC_VIEW[status];
  if (!view) return null;

  return (
    <View
      className="flex-row items-center gap-2"
      role="status"
      aria-live="polite"
    >
      <StatusDot
        dotClassName={view.dotCn}
        visible
        animated={view.animated ?? false}
      />
      <Text className="text-primary-foreground/85 text-sm font-medium">
        {view.text}
      </Text>
    </View>
  );
}

/**
 * El botón de limpiar, con su confirmación.
 *
 * Confirma con diálogo y no con el doble toque que usan Brix y Rendimiento para
 * descartar un corte: aquello deshace una cosa y esto borra la evaluación
 * entera, fotografías incluidas, sin papelera. La diferencia de peso tiene que
 * notarse, y un diálogo obliga a leer qué se va a perder.
 *
 * **La descripción la pone quien lo monta** porque lo que se borra no es lo
 * mismo en las dos pantallas: allí es un tratamiento y aquí una de cuatro
 * evaluaciones que se ven casi iguales, así que conviene nombrarla.
 *
 * El `open` es controlado para poder cerrarlo desde el propio confirmar: con
 * `AlertDialogAction` a secas, el diálogo se cierra por su cuenta pero el
 * `onPress` y el cierre compiten, y en tablet se veía el diálogo un instante
 * después del borrado.
 */
export function ClearEvaluationButton({
  onConfirm,
  disabled,
  description,
}: {
  onConfirm?: () => void;
  disabled: boolean;
  /** Qué se va a borrar, dicho en concreto. */
  description: string;
}) {
  const [open, setOpen] = useState(false);

  const handleClear = () => {
    setOpen(false);
    haptics.tap();
    onConfirm?.();
  };

  return (
    <>
      <IconButton
        onPress={() => setOpen(true)}
        disabled={disabled}
        role="button"
        aria-label="Limpiar evaluación"
        className="-mr-2"
      >
        <Icon as={BrushCleaningIcon} size={16} className="text-white" />
      </IconButton>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar la evaluación?</AlertDialogTitle>
            {/* Dice qué se va, no «esta acción no se puede deshacer»: en campo
                lo que importa es si se pierden las fotografías, que son lo
                único que no se puede volver a capturar. */}
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancelar</Text>
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onPress={handleClear}>
              <Text>Limpiar</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * El botón de sincronizar lo capturado.
 *
 * Es el mismo `SyncButton` de la pantalla principal —icono de refresco que gira
 * mientras sube—, no una copia: sincronizar es la misma acción a dos alcances
 * distintos, y con dos botones distintos parecerían dos cosas.
 *
 * **Apagado dice por qué**, y no solo que no se puede: el motivo va en el
 * `aria-label`, que es lo que lee quien no ve el icono y lo que explica el
 * estado a quien sí. Son tres situaciones y conviene no confundirlas — «ya está
 * todo sincronizado» tranquiliza, «hay un dato por revisar» es trabajo
 * pendiente.
 */
export function SendEvaluationButton({
  onPress,
  eligibility,
  sending,
  saving,
}: {
  onPress?: () => void;
  /** Qué dice `syncEligibility` de lo que hay capturado. */
  eligibility: SyncEligibility["kind"];
  /** Hay un envío en vuelo: la rueda gira y no se dispara otro encima. */
  sending: boolean;
  /**
   * La captura se está guardando. **Se apaga y no se deja pulsar**: el conteo de
   * lo pendiente se lee de SQLite y todavía no refleja lo que está escribiéndose,
   * así que el botón podría enseñarse encendido sobre una captura a medias —o
   * apagado sobre una que acaba de quedar lista—. Dura milisegundos.
   */
  saving: boolean;
}) {
  const label = saving
    ? "Guardando: espera para sincronizar"
    : eligibility === "blocked"
      ? "No se puede sincronizar: hay un dato por revisar"
      : eligibility === "nothing"
        ? "No hay nada por sincronizar"
        : "Sincronizar captura";

  return (
    <SyncButton
      onPress={onPress}
      loading={sending}
      disabled={!onPress || saving || eligibility !== "ready"}
      aria-label={label}
    />
  );
}
