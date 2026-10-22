import { View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

type PageIndicatorProps = {
  /** La posición del pager **en páginas**: 0 en la primera, 1 en la segunda… */
  progress: SharedValue<number>;
  count: number;
};

/**
 * Las barritas de «en qué paso voy», llenándose **al ritmo del desplazamiento**.
 *
 * Es una sola, fuera del pager, y no una copia dibujada dentro de cada página: al
 * deslizar, la barra del paso siguiente se va llenando con el dedo en vez de
 * saltar al final del gesto. Lee el mismo valor compartido que el scroll, así que
 * también sigue al desplazamiento animado de los botones.
 */
export function PageIndicator({ progress, count }: PageIndicatorProps) {
  return (
    <View className="flex-row items-center gap-2">
      {Array.from({ length: count }, (_, index) => (
        <Segment key={index} index={index} progress={progress} />
      ))}
    </View>
  );
}

function Segment({
  index,
  progress,
}: {
  index: number;
  progress: SharedValue<number>;
}) {
  // La primera nace llena; cada una se llena entre la página anterior y la suya.
  const fill = useAnimatedStyle(() => ({
    width: `${
      interpolate(
        progress.value,
        [index - 1, index],
        [0, 1],
        Extrapolation.CLAMP,
      ) * 100
    }%`,
  }));

  // El ancho animado va en un `Animated.View` y el color en el `View` de dentro.
  return (
    <View className="h-1 w-6 overflow-hidden rounded-full bg-border">
      <Animated.View style={[{ height: "100%" }, fill]}>
        <View className="flex-1 bg-primary" />
      </Animated.View>
    </View>
  );
}
