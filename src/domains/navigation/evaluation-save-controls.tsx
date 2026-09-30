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
import type { SaveStatus } from "@/domains/plants/store/evaluation-save-store";

/**
 * Lo que comparten las dos cabeceras de captura —tratamiento y post-cosecha—:
 * decir si el trabajo está escrito y dejar limpiar lo capturado.
 *
 * Presentacional a propósito: el `status` y el `onConfirm` llegan por props y
 * cada cabecera los saca del store por su cuenta. Así esto no sabe de dónde sale
 * el dato y la extracción no cambió el comportamiento de nadie.
 */

/**
 * Qué enseña cada estado. Sin `dotCn` es la rueda girando.
 *
 * **`pending` y `saving` se ven igual a propósito.** Son distintos por dentro
 * —uno espera a que el evaluador pare de teclear, el otro ya está escribiendo—,
 * pero eso al evaluador no le sirve de nada: la escritura en SQLite dura
 * milisegundos, así que un indicador atado solo a ella no llegaba ni a
 * dibujarse. Juntos, la rueda gira desde el primer cambio y se queda hasta que
 * termina, que es cuando de verdad hay algo que contar. Y así desaparece el
 * «Cambios por guardar», que avisaba de un problema que se arregla solo.
 */
const STATUS_VIEW: Partial<
  Record<SaveStatus, { text: string; dotCn?: string }>
> = {
  pending: { text: "Guardando…" },
  saving: { text: "Guardando…" },
  saved: { text: "Guardado", dotCn: "bg-leaf" },
  error: { text: "No se pudo guardar", dotCn: "bg-destructive" },
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
 * hay noticia que dar y un "Guardado" de entrada sería mentira.
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
