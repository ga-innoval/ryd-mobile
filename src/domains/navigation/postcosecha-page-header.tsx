import { View } from "react-native";
import Animated from "react-native-reanimated";
import { ArrowLeft, LeafIcon } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import { useAppRouter } from "@/lib/use-app-router";
import { HeaderBase } from "./header-base";

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
 * **Sin los botones de guardar y limpiar todavía.** No porque se hayan olvidado:
 * post-cosecha aún no tiene formulario ni store, así que serían dos botones
 * apagados conectados a nada. Entran cuando haya algo que guardar, y entonces
 * este archivo se parecerá aún más al de tratamientos.
 */
export function PostcosechaPageHeader({
  plantName,
  evalName,
  isLoading = false,
}: PostcosechaPageHeaderProps) {
  const router = useAppRouter();

  return (
    <HeaderBase>
      <View className="flex flex-row items-center gap-2">
        <IconButton onPress={() => router.back()} className="mr-4">
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
          <Text className="text-primary-foreground font-bold">Post-cosecha</Text>
        )}
      </View>
    </HeaderBase>
  );
}
