import { useCallback } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const DEFAULT_PRESSED_SCALE = 0.94;
const DEFAULT_DURATION_MS = 90;

type PressScaleOptions = {
  pressedScale?: number;
  durationMs?: number;
};

/**
 * Feedback táctil de tecla: encoge un poco mientras está pulsado.
 *
 * Es un hook y no un componente porque sus dos consumidores envuelven
 * pressables distintos —un `Pressable` normal y el `Item` de toggle-group— y
 * cada uno necesita colocar el `Animated.View` en un sitio distinto de su
 * árbol para no romper el layout.
 *
 * El estilo devuelto va en un `Animated.View` **envolvente**, nunca sobre el
 * mismo componente que lleva el `className`: los dos se disputarían `style`.
 */
export function usePressScale({
  pressedScale = DEFAULT_PRESSED_SCALE,
  durationMs = DEFAULT_DURATION_MS,
}: PressScaleOptions = {}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Se escribe desde handlers y nunca durante el render: es lo que evita el
  // warning de Reanimated.
  const onPressIn = useCallback(() => {
    scale.value = withTiming(pressedScale, { duration: durationMs });
  }, [scale, pressedScale, durationMs]);

  const onPressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: durationMs });
  }, [scale, durationMs]);

  return { animatedStyle, onPressIn, onPressOut };
}
