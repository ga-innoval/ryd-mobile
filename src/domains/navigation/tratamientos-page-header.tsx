import { Text } from "@/components/ui/text";
import { HeaderBase } from "./header-base";
import {
  ClearEvaluationButton,
  SaveStatusIndicator,
} from "./evaluation-save-controls";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/components/ui/icon";
import { ArrowLeft, LeafIcon, SaveIcon } from "lucide-react-native";
import { useAppRouter } from "@/lib/use-app-router";
import { useEvaluationSaveStore } from "@/domains/plants/store/evaluation-save-store";

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
        <View className="h-4 w-28 rounded bg-primary-foreground/20" />
        <Text className="text-primary-foreground/40">/</Text>
        <View className="h-4 w-16 rounded bg-primary-foreground/20" />
      </View>
    </Animated.View>
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
          <ClearEvaluationButton
            onConfirm={actions?.clear}
            disabled={disabled}
            description="Se borrarán todas las respuestas de este tratamiento y sus fotografías. No se podrán recuperar."
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
