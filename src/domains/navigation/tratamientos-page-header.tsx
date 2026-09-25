import { useEffect } from "react";
import { Text } from "@/components/ui/text";
import { HeaderBase } from "./header-base";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/components/ui/icon";
import {
  ArrowLeft,
  LeafIcon,
  LoaderCircleIcon,
  SaveIcon,
  XIcon,
} from "lucide-react-native";
import { useAppRouter } from "@/lib/use-app-router";
import {
  useEvaluationSaveStore,
  type SaveStatus,
} from "@/domains/plants/store/evaluation-save-store";
import { cn } from "@/lib/utils";

interface TratamientosPageHeader {
  tratamientoName?: string;
  plantName?: string;
  isLoading?: boolean;
}

/**
 * Solo los nombres son skeleton; la estructura del header —fondo, botón de
 * volver, acciones— se monta desde el primer frame para que no haya salto de
 * layout al llegar el dato.
 */
function HeaderDataSkeleton() {
  const pulseStyle = usePulseAnimation({ minOpacity: 0.3 });

  return (
    <Animated.View style={pulseStyle}>
      <View className="flex-row items-center gap-2">
        <View className="h-4 w-24 rounded bg-primary-foreground/20" />
        <Text className="text-primary-foreground/40">/</Text>
        <View className="h-4 w-16 rounded bg-primary-foreground/20" />
      </View>
    </Animated.View>
  );
}

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
 * Sin caja propia, pegado a los botones de descartar y guardar: con fondo
 * parecería otro botón. Y con la evaluación recién abierta no dice nada — no
 * hay noticia que dar y un "Guardado" de entrada sería mentira.
 */
function SaveStatusIndicator({ status }: { status: SaveStatus }) {
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

export function TratamientosPageHeader({
  tratamientoName,
  plantName,
  isLoading = false,
}: TratamientosPageHeader) {
  const router = useAppRouter();
  const status = useEvaluationSaveStore((state) => state.status);
  // `null` mientras no haya una evaluación montada detrás: esta cabecera existe
  // desde el primer frame, y hasta entonces no hay nada que guardar.
  const actions = useEvaluationSaveStore((state) => state.actions);

  // Mientras escribe no se sale, no se descarta y no se vuelve a guardar: la
  // cabecera entera espera a que la escritura termine.
  const busy = status === "saving";
  const disabled = busy || !actions;

  return (
    <HeaderBase>
      <View className="flex flex-row items-center gap-2">
        <IconButton
          onPress={() => router.back()}
          disabled={busy}
          className="mr-4"
        >
          <Icon size={16} as={ArrowLeft} className="text-white" />
        </IconButton>

        <Icon size={16} as={LeafIcon} className="text-leaf" />

        {isLoading ? (
          <HeaderDataSkeleton />
        ) : plantName && tratamientoName ? (
          <>
            <Text className="text-primary-foreground font-bold">
              {plantName}
            </Text>
            <Text className="text-primary-foreground/40">/</Text>
            <Text className="text-primary-foreground/80 font-medium">
              {tratamientoName}
            </Text>
          </>
        ) : (
          <Text className="text-primary-foreground font-bold">Tratamiento</Text>
        )}
      </View>

      {/* El estado va aquí, junto a las acciones que lo cambian, y no del lado
          de los nombres: lo que se mira antes de tocar «Guardar» es si hace
          falta tocarlo. */}
      <View className="flex-row items-center gap-4">
        <SaveStatusIndicator status={status} />

        <View className="flex-row gap-2">
          <IconButton
            onPress={actions?.discard}
            disabled={disabled}
            role="button"
            aria-label="Descartar cambios"
          >
            <Icon as={XIcon} size={16} className="text-white" />
          </IconButton>
          <IconButton
            onPress={actions?.save}
            disabled={disabled}
            role="button"
            aria-label="Guardar"
          >
            <Icon as={SaveIcon} size={16} className="text-white" />
          </IconButton>
        </View>
      </View>
    </HeaderBase>
  );
}
