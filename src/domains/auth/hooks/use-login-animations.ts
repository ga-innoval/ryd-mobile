import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
} from "react-native-reanimated";

export function useLoginAnimations(heroHeight: number) {
  const { progress } = useReanimatedKeyboardAnimation();

  const translateY = useDerivedValue(() =>
    interpolate(progress.value, [0, 1], [0, -heroHeight], Extrapolation.CLAMP),
  );

  const heroAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [0, 1],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateY: translateY.value }],
      opacity,
    };
  });

  const formAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  return { heroAnimatedStyle, formAnimatedStyle };
}
