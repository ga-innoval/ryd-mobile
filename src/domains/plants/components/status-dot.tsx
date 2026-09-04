import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const PULSE_HALF_CYCLE_MS = 900;
const PULSE_MIN_OPACITY = 0.15;
const PULSE_EASING = Easing.bezier(0.4, 0, 0.6, 1);

export function StatusDot({
  dotClassName,
  visible,
  animated,
}: {
  dotClassName: string;
  visible: boolean;
  animated: boolean;
}) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!animated || !visible) {
      opacity.value = 1;
      return;
    }

    opacity.value = withRepeat(
      withTiming(PULSE_MIN_OPACITY, {
        duration: PULSE_HALF_CYCLE_MS,
        easing: PULSE_EASING,
      }),
      -1,
      true,
    );
  }, [animated, visible, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  return (
    <Animated.View style={pulseStyle}>
      <View className={cn("size-2 rounded-full", dotClassName)} />
    </Animated.View>
  );
}
