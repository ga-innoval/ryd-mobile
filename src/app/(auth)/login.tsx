import { View } from "react-native";
import Animated from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { LoginHero } from "@/domains/auth/components/login-hero";
import { LoginForm } from "@/domains/auth/components/login-form";
import { app } from "@/lib/app-metadata";
import { useScreenOrientation } from "@/hooks/use-screen-orientation";
import { useLoginAnimations } from "@/domains/auth/hooks/use-login-animations";

const HERO_HEIGHT = {
  landscape: 320,
  portrait: 640,
};

export default function LoginPage() {
  const { orientation } = useScreenOrientation();
  const heroHeight = HERO_HEIGHT[orientation];

  const { heroAnimatedStyle, formAnimatedStyle } =
    useLoginAnimations(heroHeight);

  return (
    <View className="flex-1">
      <Animated.View style={[{ height: heroHeight }, heroAnimatedStyle]}>
        <LoginHero />
      </Animated.View>
      <Animated.View
        className="flex-1 items-center justify-center"
        style={formAnimatedStyle}
      >
        <LoginForm />
        <View className="p-6 items-center">
          <Text variant="muted">
            {app.name} {app.version} © {app.developer}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
