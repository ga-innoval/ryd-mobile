import { Pressable, type PressableProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const DEFAULT_PRESSED_SCALE = 0.94;
const DEFAULT_DURATION_MS = 90;

type PressableScaleProps = PressableProps & {
  /** Escala a la que encoge mientras está pulsado. */
  pressedScale?: number;
  durationMs?: number;
};

/**
 * `Pressable` con feedback táctil: encoge un poco al pulsarse, como una tecla.
 *
 * La escala vive en un `Animated.View` **envolvente** y el `className` se
 * queda en el `Pressable` de dentro. Esa separación no es estilo: superponer
 * Reanimated sobre un componente que ya usa `cssInterop` hace que ambos se
 * disputen la prop `style`. Resolverlo aquí evita que cada consumidor lo
 * repita, o lo repita mal.
 */
export function PressableScale({
  pressedScale = DEFAULT_PRESSED_SCALE,
  durationMs = DEFAULT_DURATION_MS,
  onPressIn,
  onPressOut,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        // El shared value se escribe desde los handlers y nunca durante el
        // render: es lo que evita el warning de Reanimated.
        onPressIn={(event) => {
          scale.value = withTiming(pressedScale, { duration: durationMs });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.value = withTiming(1, { duration: durationMs });
          onPressOut?.(event);
        }}
        {...props}
      />
    </Animated.View>
  );
}
