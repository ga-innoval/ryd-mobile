import { Pressable } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import type { StyleProp, ViewStyle } from "react-native";
import { ArrowUpIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";

interface ScrollToTopButtonProps {
  onPress: () => void;
  style: StyleProp<AnimatedStyle<ViewStyle>>;
}

export function ScrollToTopButton({ onPress, style }: ScrollToTopButtonProps) {
  return (
    <Animated.View
      style={[style, { position: "absolute", bottom: 24, right: 24 }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Volver arriba"
        className="w-12 h-12 rounded-full bg-primary items-center justify-center shadow-lg"
      >
        <Icon as={ArrowUpIcon} size={24} className="text-primary-foreground" />
      </Pressable>
    </Animated.View>
  );
}
