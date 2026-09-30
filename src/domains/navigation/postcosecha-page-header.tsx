import { View } from "react-native";
import Animated from "react-native-reanimated";
import { ArrowLeft, LeafIcon, SaveIcon } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import { useAppRouter } from "@/lib/use-app-router";
import { HeaderBase } from "./header-base";
import {
  ClearEvaluationButton,
  SaveStatusIndicator,
} from "./evaluation-save-controls";
import { useEvaluationSaveStore } from "@/domains/plants/store/evaluation-save-store";

type PostcosechaPageHeaderProps = {
  plantName?: string;
  /** Los días y el empaque de la evaluación abierta, ya compuestos. */
  evalName?: string;
  isLoading?: boolean;
};

/** Solo los nombres son skeleton; la estructura del header se monta desde el
 *  primer frame para que no haya salto de layout al llegar el dato. */
function HeaderDataSkeleton() {
  const pulseStyle = usePulseAnimation({ minOpacity: 0.3 });

  return (
    <Animated.View style={pulseStyle}>
      <View className="flex-row items-center gap-2">
        <View className="h-4 w-28 rounded bg-primary-foreground/20" />
        <Text className="text-primary-foreground/40">/</Text>
        <View className="h-4 w-24 rounded bg-primary-foreground/20" />
      </View>
    </Animated.View>
  );
}

/**
 * La cabecera de una evaluación de post-cosecha.
 *
 * Hermana de `TratamientosPageHeader` y con la misma forma a propósito: son la
 * misma tarea en dos sitios y leerse igual es parte de que se entiendan. Lo que
 * cambia es qué va después de la plantación — allí el tratamiento, aquí los
 * días y el empaque.
 *
 * Comparte con ella el estado de guardado y los dos botones, que salen del
 * mismo store: solo hay una pantalla de captura abierta a la vez, así que no
 * hace falta que el store sepa de quién es lo que cuenta.
 */
export function PostcosechaPageHeader({
  plantName,
  evalName,
  isLoading = false,
}: PostcosechaPageHeaderProps) {
  const router = useAppRouter();
  const status = useEvaluationSaveStore((state) => state.status);
  // `null` mientras no haya una evaluación montada detrás: esta cabecera existe
  // desde el primer frame, y hasta entonces no hay nada que guardar.
  const actions = useEvaluationSaveStore((state) => state.actions);

  // Mientras escribe no se sale, no se limpia y no se vuelve a guardar: la
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
        ) : plantName && evalName ? (
          <>
            <Text className="text-primary-foreground font-bold">
              {plantName}
            </Text>
            <Text className="text-primary-foreground/40">/</Text>
            <Text className="text-primary-foreground/80 font-medium">
              {evalName}
            </Text>
          </>
        ) : (
          <Text className="text-primary-foreground font-bold">
            Post-cosecha
          </Text>
        )}
      </View>

      {/* El estado va aquí, junto a las acciones que lo cambian, y no del lado
          de los nombres: lo que se mira antes de tocar «Guardar» es si hace
          falta tocarlo. */}
      <View className="flex-row items-center gap-4">
        <SaveStatusIndicator status={status} />

        <View className="flex-row gap-2">
          {/* Nombra la evaluación: las cuatro se ven casi iguales y con los
              chips es fácil estar en la que no es. */}
          <ClearEvaluationButton
            onConfirm={actions?.clear}
            disabled={disabled}
            description={`Se borrarán todas las respuestas de esta evaluación${
              evalName ? ` (${evalName})` : ""
            } y sus fotografías. No se podrán recuperar.`}
          />
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
