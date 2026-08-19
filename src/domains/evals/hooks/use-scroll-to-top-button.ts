import { useCallback, useRef } from "react";
import type { FlashListRef } from "@shopify/flash-list";
import {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
} from "react-native-reanimated";

const SHOW_THRESHOLD_PX = 150;
const DIRECTION_SENSITIVITY_PX = 4;

export function useScrollToTopButton<T>() {
  const listRef = useRef<FlashListRef<T>>(null);

  const isVisible = useSharedValue(0);
  const prevScrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentY = event.contentOffset.y;
      const diff = currentY - prevScrollY.value;
      const pastThreshold = currentY > SHOW_THRESHOLD_PX;
      const scrollingUp = diff < -DIRECTION_SENSITIVITY_PX;

      // Se muestra en cuanto pasa el umbral (sin importar si sigue en
      // movimiento, cubre el caso de llegar al fondo y detenerse ahí).
      // Se oculta solo si el usuario vuelve activamente hacia el top,
      // o si ya está lo bastante cerca de él.
      if (pastThreshold) {
        isVisible.value = withTiming(1, { duration: 200 });
      } else if (scrollingUp || !pastThreshold) {
        isVisible.value = withTiming(0, { duration: 200 });
      }

      if (Math.abs(diff) > DIRECTION_SENSITIVITY_PX) {
        prevScrollY.value = currentY;
      }
    },
  });

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: isVisible.value,
    transform: [{ translateY: (1 - isVisible.value) * 20 }],
  }));

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  return { listRef, scrollHandler, buttonAnimatedStyle, scrollToTop };
}
