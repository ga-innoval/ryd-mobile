import { View } from "react-native";
import Animated from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import type { TratamientoRecord } from "../types";

type ChipVariant = "card" | "header";

// Entre variantes solo cambia el aspecto. El comportamiento —feedback de
// pulsación y truncado del nombre— es el mismo, y qué significa pulsar lo
// decide cada pantalla vía `onPress`.
type VariantStyles = {
  container: string;
  text: string;
  // El activo invierte los colores, así que depende del fondo sobre el que va
  // el chip. Por eso vive en la variante y no fuera de ella.
  activeContainer: string;
  activeText: string;
};

const VARIANTS: Record<ChipVariant, VariantStyles> = {
  card: {
    container: "w-28 h-[72px] px-2.5 border-border",
    text: "max-w-24",
    activeContainer: "bg-primary border-primary",
    activeText: "text-primary-foreground",
  },
  // Más pequeño y con borde claro, porque va sobre `bg-primary`.
  header: {
    container: "w-28 h-10 px-2 border-primary-foreground/50 border",
    text: "text-primary-foreground text-sm",
    activeContainer: "bg-foreground border-foreground/20",
    activeText: "text-white",
  },
};

type TratamientoChipProps = {
  tratamiento: TratamientoRecord;
  onPress: () => void;
  variant?: ChipVariant;
  isActive?: boolean;
  /** Su captura tiene un dato imposible: el borde lo dice sin abrirlo. */
  hasError?: boolean;
  /** Lo capturado, de 0 a 1. Solo lo enseña la variante `card`; en la cabecera
   *  el avance ya está a la vista en las propias secciones. */
  progress?: number;
};

export function TratamientoChip({
  tratamiento,
  onPress,
  variant = "card",
  isActive = false,
  hasError = false,
  progress = 0,
}: TratamientoChipProps) {
  const styles = VARIANTS[variant];

  return (
    <PressableScale
      onPress={onPress}
      className={cn(
        "rounded-xl items-center justify-center border-2 overflow-hidden flex-col",
        styles.container,
        isActive && styles.activeContainer,
        // Después del activo para ganarle el borde: si el tratamiento abierto es
        // el que falla, lo que hay que ver es el error.
        hasError && "bg-destructive-background border-destructive/20",
      )}
    >
      <Text
        numberOfLines={1}
        className={cn(
          "font-medium",
          styles.text,
          isActive && styles.activeText,
          hasError && "text-destructive",
        )}
      >
        {tratamiento.name}
      </Text>
      {variant === "card" && (
        // Sin el porcentaje en texto: en un chip de 112 px el número le come el
        // sitio al nombre, y la barra ya dice lo mismo de un vistazo.
        //
        // `w-auto` neutraliza el `w-full` de la raíz de `Progress`, que con el
        // `flexShrink: 0` de React Native se saldría del chip.
        <Progress
          value={progress * 100}
          className="mt-1.5 h-1.5 w-auto self-stretch bg-primary/15"
          indicatorClassName="bg-foreground"
        />
      )}
    </PressableScale>
  );
}

/** Mismo hueco que la variante `header`, para no dar salto al llegar el dato. */
export function TratamientoChipSkeleton() {
  const pulseStyle = usePulseAnimation({ minOpacity: 0.3 });

  return (
    <Animated.View style={pulseStyle}>
      <View className="w-20 h-10 rounded-xl bg-primary-foreground/20" />
    </Animated.View>
  );
}
