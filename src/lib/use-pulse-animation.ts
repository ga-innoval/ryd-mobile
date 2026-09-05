import { useEffect } from "react";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

// Los valores por defecto replican el `animate-pulse` de Tailwind: ciclo de
// 2s entre opacidad 1 y 0.5, con esa misma curva.
const DEFAULT_CYCLE_MS = 2_000;
const DEFAULT_MIN_OPACITY = 0.5;
const PULSE_EASING = Easing.bezier(0.4, 0, 0.6, 1);

type PulseOptions = {
  minOpacity?: number;
  cycleMs?: number;
  enabled?: boolean;
};

/**
 * Pulso de opacidad con Reanimated, en sustitución de las clases `animate-*`
 * de NativeWind.
 *
 * NativeWind las implementa sobre shared values y los escribe **durante el
 * render**, lo que dispara "Writing to `value` during component render" en
 * cuanto el className depende de props. Aquí la escritura ocurre en un efecto.
 *
 * Devuelve el estilo para un `Animated.View` **envolvente**: no lo apliques al
 * mismo componente que ya recibe `className`, o NativeWind y Reanimated se
 * disputan la prop `style`.
 */
export function usePulseAnimation({
  minOpacity = DEFAULT_MIN_OPACITY,
  cycleMs = DEFAULT_CYCLE_MS,
  enabled = true,
}: PulseOptions = {}) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!enabled) {
      opacity.value = 1;
      return;
    }

    opacity.value = withRepeat(
      // `withRepeat` en reverse hace el tramo de vuelta, así que cada tramo
      // dura media vuelta del ciclo.
      withTiming(minOpacity, {
        duration: cycleMs / 2,
        easing: PULSE_EASING,
      }),
      -1,
      true,
    );
  }, [enabled, minOpacity, cycleMs, opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}
