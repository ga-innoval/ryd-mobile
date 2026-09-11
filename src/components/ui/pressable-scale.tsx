import { Pressable, type PressableProps } from "react-native";
import Animated from "react-native-reanimated";
import { usePressScale } from "@/lib/use-press-scale";

type PressableScaleProps = PressableProps & {
  /** Escala a la que encoge mientras está pulsado. */
  pressedScale?: number;
  durationMs?: number;
};

/**
 * `Pressable` con feedback táctil: encoge un poco al pulsarse, como una tecla.
 *
 * Para un pressable que además sea hijo flex —o que no sea un `Pressable`
 * normal, como el `Item` de un toggle-group— usar `usePressScale` directamente
 * y colocar el `Animated.View` donde no estorbe al layout.
 */
export function PressableScale({
  pressedScale,
  durationMs,
  onPressIn,
  onPressOut,
  ...props
}: PressableScaleProps) {
  const scale = usePressScale({ pressedScale, durationMs });

  return (
    <Animated.View style={scale.animatedStyle}>
      <Pressable
        onPressIn={(event) => {
          scale.onPressIn();
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.onPressOut();
          onPressOut?.(event);
        }}
        {...props}
      />
    </Animated.View>
  );
}
