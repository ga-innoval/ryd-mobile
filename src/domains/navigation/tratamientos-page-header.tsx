import { Text } from "@/components/ui/text";
import { HeaderBase } from "./header-base";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/components/ui/icon";
import { ArrowLeft, LeafIcon, SaveIcon, XIcon } from "lucide-react-native";
import { useAppRouter } from "@/lib/use-app-router";

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

export function TratamientosPageHeader({
  tratamientoName,
  plantName,
  isLoading = false,
}: TratamientosPageHeader) {
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

      <View className="flex-row gap-2">
        <IconButton>
          <Icon as={XIcon} size={16} className="text-white" />
        </IconButton>
        <IconButton>
          <Icon as={SaveIcon} size={16} className="text-white" />
        </IconButton>
      </View>
    </HeaderBase>
  );
}
