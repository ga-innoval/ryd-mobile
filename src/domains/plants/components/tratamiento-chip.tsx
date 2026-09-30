import { View } from "react-native";
import Animated from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import { cn } from "@/lib/utils";
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
    activeContainer: "bg-primary-foreground/20 border-primary-foreground/20",
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
  /** Lo capturado, de 0 a 1. Solo lo enseña la variante `card` —llenándose—; en
   *  la cabecera el avance ya está a la vista en las propias secciones. */
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
      {variant === "card" && (
        // **El avance llena el chip, no lleva barra** (opción C del artboard).
        // Con una barra al pie, un chip de 112 px reparte su alto entre el
        // nombre y una línea de 4 px que hay que ir a buscar; llenándolo, el
        // avance se lee sin mirar ningún sitio en concreto.
        //
        // Va declarado **antes** que el texto y sin `zIndex`: en React Native
        // pinta encima lo que se declara después, así que el orden basta y no
        // hace falta apilar nada. El recorte lo pone el `overflow-hidden` de la
        // raíz, que es lo que le da al relleno la curva del borde.
        <View
          pointerEvents="none"
          style={{ width: `${progress * 100}%` }}
          className={cn(
            "absolute bottom-0 left-0 top-0",
            // Con un dato imposible el chip ya está en rojo; un relleno verde
            // encima lo dejaría de dos colores sin querer decir nada nuevo.
            hasError ? "bg-destructive/15" : "bg-leaf/15",
          )}
        />
      )}

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
