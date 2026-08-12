import { Icon } from "@/components/ui/icon";
import { RefreshCwIcon } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, View, type PressableProps } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface EvalsSyncButtonProps extends PressableProps {
  loading?: boolean;
  onPress?: () => void;
}

const AnimatedIcon = Animated.createAnimatedComponent(Icon);

export function EvalsSyncButton({ loading, onPress }: EvalsSyncButtonProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (loading) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 800, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      rotation.value = withTiming(0, { duration: 200 });
    }
  }, [loading]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Pressable
      className="w-8 h-8 rounded-full bg-primary-foreground/15 items-center justify-center"
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Sincronizar cambios"
      onPress={onPress}
    >
      <View>
        <AnimatedIcon
          as={RefreshCwIcon}
          size={16}
          className="text-primary-foreground"
          style={animatedStyle}
        />
      </View>
    </Pressable>
  );
}
