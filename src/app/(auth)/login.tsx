import { View } from "react-native";
import Animated from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { LoginHero } from "@/domains/auth/components/login-hero";
import { LoginForm } from "@/domains/auth/components/login-form";
import { app } from "@/lib/app-metadata";
import { useLoginAnimations } from "@/domains/auth/hooks/use-login-animations";
import { useHeroHeight } from "@/domains/auth/hooks/use-hero-height";

export default function LoginPage() {
  const heroHeight = useHeroHeight();
  const { heroAnimatedStyle, formAnimatedStyle } = useLoginAnimations();

  return (
    <View className="flex-1">
      <Animated.View style={[{ height: heroHeight }, heroAnimatedStyle]}>
        <LoginHero />
      </Animated.View>
      <Animated.View
        className="flex-1 items-center justify-center bg-white"
        style={formAnimatedStyle}
      >
        <LoginForm />
        <View className="items-center">
          <Text variant="muted">
            {app.name} {app.version} © {app.developer}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
