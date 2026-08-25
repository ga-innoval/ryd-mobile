import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import {
  useAnimatedStyle,
  Extrapolation,
  interpolate,
} from "react-native-reanimated";

export function useLoginAnimations() {
  const { height, progress } = useReanimatedKeyboardAnimation();

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: height.value }],
    opacity: interpolate(progress.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }));

  const formAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: height.value }],
  }));

  return { heroAnimatedStyle, formAnimatedStyle };
}
