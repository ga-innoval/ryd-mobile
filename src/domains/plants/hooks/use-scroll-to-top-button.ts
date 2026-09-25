import { useCallback, useRef } from "react";
import type { FlashListRef } from "@shopify/flash-list";
import {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import { appearTo, useAppearAnimation } from "@/lib/use-appear-animation";

const SHOW_THRESHOLD_PX = 150;
const DIRECTION_SENSITIVITY_PX = 4; // Para no contemplar micro-scrolls

export function useScrollToTopButton<T>() {
  const listRef = useRef<FlashListRef<T>>(null);

  // La curva de entrada y salida es compartida con el atajo al error de
  // captura: los dos flotan sobre el contenido y tienen que aparecer igual.
  const { style: buttonAnimatedStyle, progress: isVisible } =
    useAppearAnimation();
  const prevScrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      // Px que el usuario ha recorrido hacia abajo. (0 = top de la lista)
      const currentY = event.contentOffset.y;
      // Diferencia de cuánto cambió el scroll desde la última vez que se ejecutó el handler.
      // Si diff es positivo, el usuario scrolleó hacia abajo
      const diff = currentY - prevScrollY.value;

      const pastThreshold = currentY > SHOW_THRESHOLD_PX;

      // Se muestra en cuanto pasa el treshhold (sin importar si sigue en
      // movimiento, cubre el caso de llegar al fondo y detenerse ahí).
      // Se oculta solo si el usuario vuelve activamente hacia el top,
      // o si ya está lo suficientemente cerca de él.
      appearTo(isVisible, pastThreshold);

      if (Math.abs(diff) > DIRECTION_SENSITIVITY_PX) {
        prevScrollY.value = currentY;
      }
    },
  });

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  return { listRef, scrollHandler, buttonAnimatedStyle, scrollToTop };
}
