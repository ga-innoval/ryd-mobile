import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { RefreshCwIcon } from "lucide-react-native";
import { useEffect } from "react";
import { type PressableProps } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface SyncButtonProps extends PressableProps {
  loading?: boolean;
  onPress?: () => void;
}

const AnimatedIcon = Animated.createAnimatedComponent(Icon);

export function SyncButton({
  loading,
  disabled,
  onPress,
  ...props
}: SyncButtonProps) {
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
    <IconButton
      disabled={loading || disabled}
      accessibilityRole="button"
      accessibilityLabel="Sincronizar cambios"
      onPress={onPress}
      {...props}
    >
      <AnimatedIcon
        as={RefreshCwIcon}
        size={16}
        className="text-primary-foreground"
        style={animatedStyle}
      />
    </IconButton>
  );
}
