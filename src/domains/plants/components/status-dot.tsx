import { cn } from "@/lib/utils";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import { View } from "react-native";
import Animated from "react-native-reanimated";

// El `animate-pulse-deep` que había en `tailwind.config.js`: más profundo y
// algo más rápido que el pulso por defecto.
const DOT_PULSE = { minOpacity: 0.15, cycleMs: 1_800 };

export function StatusDot({
  dotClassName,
  visible,
  animated,
}: {
  dotClassName: string;
  visible: boolean;
  animated: boolean;
}) {
  const pulseStyle = usePulseAnimation({
    ...DOT_PULSE,
    enabled: animated && visible,
  });

  if (!visible) return null;

  // La opacidad vive en el `Animated.View` y el color/tamaño en el `View` de
  // dentro: NativeWind y Reanimated no deben disputarse la misma prop `style`.
  return (
    <Animated.View style={pulseStyle}>
      <View className={cn("size-2 rounded-full", dotClassName)} />
    </Animated.View>
  );
}
