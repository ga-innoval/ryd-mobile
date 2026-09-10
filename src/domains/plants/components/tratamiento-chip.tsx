import { View } from "react-native";
import Animated from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import { cn } from "@/lib/utils";
import type { TratamientoRecord } from "../types";

type ChipVariant = "card" | "header";

// Entre variantes solo cambia el aspecto. El comportamiento —feedback de
// pulsación y truncado del nombre— es el mismo, y qué significa pulsar lo
// decide cada pantalla vía `onPress`.
type VariantStyles = {
  container: string;
  text: string;
  // El activo invierte los colores, así que depende del fondo sobre el que va
  // el chip. Por eso vive en la variante y no fuera de ella.
  activeContainer: string;
  activeText: string;
};

const VARIANTS: Record<ChipVariant, VariantStyles> = {
  card: {
    container: "w-28 h-16 border-border",
    text: "max-w-24",
    activeContainer: "bg-primary border-primary",
    activeText: "text-primary-foreground",
  },
  // Más pequeño y con borde claro, porque va sobre `bg-primary`.
  header: {
    container: "w-20 h-10 px-2 border-primary-foreground/30 border",
    text: "text-primary-foreground text-sm",
    activeContainer: "bg-primary-foreground border-primary-foreground",
    activeText: "text-primary",
  },
};

type TratamientoChipProps = {
  tratamiento: TratamientoRecord;
  onPress: () => void;
  variant?: ChipVariant;
  isActive?: boolean;
};

export function TratamientoChip({
  tratamiento,
  onPress,
  variant = "card",
  isActive = false,
}: TratamientoChipProps) {
  const styles = VARIANTS[variant];

  return (
    <PressableScale
      onPress={onPress}
      className={cn(
        "rounded-xl items-center justify-center border-2 flex-row overflow-hidden",
        styles.container,
        isActive && styles.activeContainer,
      )}
    >
      <Text
        numberOfLines={1}
        className={cn(
          "font-medium",
          styles.text,
          isActive && styles.activeText,
        )}
      >
        {tratamiento.name}
      </Text>
    </PressableScale>
  );
}

/** Mismo hueco que la variante `header`, para no dar salto al llegar el dato. */
export function TratamientoChipSkeleton() {
  const pulseStyle = usePulseAnimation({ minOpacity: 0.3 });

  return (
    <Animated.View style={pulseStyle}>
      <View className="w-20 h-10 rounded-xl bg-primary-foreground/20" />
    </Animated.View>
  );
}
