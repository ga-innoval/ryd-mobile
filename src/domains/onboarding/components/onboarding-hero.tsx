import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { LucideIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/** Los tres círculos del diseño (156, 112 y 68) en proporción al exterior. */
const MIDDLE = 112 / 156;
const INNER = 68 / 156;
const ICON = 34 / 156;

type OnboardingHeroProps = {
  icon: LucideIcon;
  /** Diámetro del círculo exterior. */
  size?: number;
  /** Un contador sobre el icono, como el de la campana (paso de notificaciones). */
  badge?: string;
  /** El círculo interior en verde: el paso final, ya hecho. */
  done?: boolean;
  /** Late mientras algo dura: la descarga. */
  pulsing?: boolean;
};

/**
 * El dibujo de la cabecera del modal: un icono dentro de tres círculos
 * concéntricos. Las medidas salen de `size`, y el exterior late cuando `pulsing`.
 *
 * El latido va en un `Animated.View` envolvente y el color en el `View` de
 * dentro: NativeWind y Reanimated no deben disputarse la misma prop `style`.
 */
export function OnboardingHero({
  icon,
  size = 140,
  badge,
  done,
  pulsing,
}: OnboardingHeroProps) {
  const middle = size * MIDDLE;
  const inner = size * INNER;

  const beat = useSharedValue(0);

  useEffect(() => {
    beat.value = pulsing
      ? withRepeat(
          withSequence(
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
        )
      : withTiming(0, { duration: 200 });
  }, [pulsing, beat]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 1 - beat.value * 0.25,
    transform: [{ scale: 1 + beat.value * 0.08 }],
  }));

  return (
    <Animated.View style={pulseStyle}>
      <View
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className="items-center justify-center bg-white/10"
      >
        <View
          style={{ width: middle, height: middle, borderRadius: middle / 2 }}
          className="items-center justify-center bg-white/15"
        >
          <View
            style={{ width: inner, height: inner, borderRadius: inner / 2 }}
            className={cn(
              "items-center justify-center",
              done ? "bg-leaf" : "bg-white",
            )}
          >
            <Icon
              as={icon}
              size={size * ICON}
              strokeWidth={done ? 2.4 : 1.8}
              className={done ? "text-foreground" : "text-primary"}
            />

            {badge !== undefined && (
              <View className="absolute -right-1.5 -top-1 h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-destructive px-1.5">
                <Text className="text-xs font-bold text-white">{badge}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
