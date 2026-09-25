import { useEffect } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Cómo entran y salen los atajos flotantes de la app: el botón de volver arriba
 * del listado y el de ir al error de captura. Se desvanecen y suben un poco.
 *
 * Los números viven aquí y no en cada botón porque son el mismo gesto: dos
 * atajos que aparecen distinto se leerían como dos cosas distintas de la app.
 */
const APPEAR_MS = 200;
const APPEAR_PX = 20;

/**
 * Enciende o apaga la aparición.
 *
 * Es `worklet` porque hay quien lo decide en el hilo de la interfaz —el listado
 * lo resuelve dentro de su `useAnimatedScrollHandler`— y quien lo decide desde
 * JS. Así los dos usan la misma curva sin repetirla.
 */
export function appearTo(progress: SharedValue<number>, visible: boolean) {
  "worklet";
  progress.value = withTiming(visible ? 1 : 0, { duration: APPEAR_MS });
}

/**
 * El estilo de aparición y el valor que lo gobierna.
 *
 * Con `visible` se maneja solo; sin él, quien lo monte mueve `progress` por su
 * cuenta con `appearTo` —que es lo que hace falta cuando la decisión se toma
 * dentro de un worklet de scroll—.
 */
export function useAppearAnimation(visible?: boolean) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible === undefined) return;

    appearTo(progress, visible);
  }, [visible, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * APPEAR_PX }],
  }));

  return { style, progress };
}
