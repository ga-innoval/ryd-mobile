import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** Cuánto de la pista ocupa el tramo que corre. */
const SEGMENT = 0.4;

/**
 * Una barra que corre mientras algo dura, **sin pretender medirlo**: la
 * descarga es una sola petición y nada dice cuánto lleva, así que un porcentaje
 * sería inventado.
 *
 * El `Animated.View` solo lleva el estilo animado y el color vive en el `View` de
 * dentro: NativeWind y Reanimated no deben disputarse la misma prop `style`.
 */
export function IndeterminateBar() {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [-width * SEGMENT, width],
        ),
      },
    ],
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Descargando"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="h-1 overflow-hidden rounded-full bg-primary/20"
    >
      <Animated.View
        style={[style, { width: width * SEGMENT, height: "100%" }]}
      >
        <View className="h-full rounded-full bg-primary" />
      </Animated.View>
    </View>
  );
}
