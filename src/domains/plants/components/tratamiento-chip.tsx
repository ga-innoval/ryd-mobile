import { View } from "react-native";
import Animated from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import { cn } from "@/lib/utils";
import { CircleCheckIcon, CircleXIcon } from "lucide-react-native";
import { isComplete } from "../lib/evaluation-progress";
import { CaptureChip } from "./capture-chip";
import type { TratamientoRecord } from "../types";

type ChipVariant = "card" | "header";

/** El fondo del renglón de tratamiento, para que la señal de la esquina tape el
 *  borde en vez de dejarlo cruzar por detrás. Es el token `background`. */
const ROW_BACKGROUND = "#f5f2eb";

type TratamientoChipProps = {
  tratamiento: TratamientoRecord;
  onPress: () => void;
  variant?: ChipVariant;
  isActive?: boolean;
  /** Su captura tiene un dato imposible: la señal de la esquina lo dice sin
   *  abrirlo. */
  hasError?: boolean;
  /** Lo capturado, de 0 a 1. Solo lo enseña la variante `card` —llenándose—; en
   *  la cabecera el avance ya está a la vista en las propias secciones. */
  progress?: number;
};

/**
 * Un tratamiento, en la tarjeta de plantación o en la cabecera de su pantalla.
 *
 * **Las dos variantes casi no comparten nada y por eso van separadas.** La de
 * tarjeta es una captura —se llena con su avance y señala en la esquina si está
 * lista o rota—, así que la caja se la pone `CaptureChip`, la misma que usan las
 * evaluaciones de post-cosecha. La de cabecera solo sitúa en cuál estás: ni
 * avance ni señal, más pequeña y con borde claro porque va sobre `bg-primary`.
 */
export function TratamientoChip({
  tratamiento,
  onPress,
  variant = "card",
  isActive = false,
  hasError = false,
  progress = 0,
}: TratamientoChipProps) {
  if (variant === "header") {
    return (
      <PressableScale
        onPress={onPress}
        className={cn(
          "h-10 w-28 flex-col items-center justify-center rounded-xl border border-primary-foreground/50 px-2",
          isActive && "border-primary-foreground/20 bg-primary-foreground/20",
        )}
      >
        <Text
          numberOfLines={1}
          className={cn(
            "text-sm font-medium text-primary-foreground",
            isActive && "text-white",
          )}
        >
          {tratamiento.name}
        </Text>
      </PressableScale>
    );
  }

  return (
    <CaptureChip
      onPress={onPress}
      progress={progress}
      // Con un dato imposible el chip ya está en rojo; un relleno verde encima
      // lo dejaría de dos colores sin querer decir nada nuevo.
      fillClassName={hasError ? "bg-destructive/15" : "bg-leaf/20"}
      // Una sola señal, y **el error gana**: una captura llena con un dato
      // imposible no está terminada —es justo lo que el error impide—, así que
      // enseñar la palomita diría lo contrario.
      badge={
        hasError
          ? {
              icon: CircleXIcon,
              className: "text-destructive",
              fill: ROW_BACKGROUND,
            }
          : isComplete(progress)
            ? {
                icon: CircleCheckIcon,
                className: "text-leaf",
                fill: ROW_BACKGROUND,
              }
            : undefined
      }
      accessibilityLabel={tratamiento.name}
    >
      <Text
        numberOfLines={1}
        className={cn("max-w-24 font-medium", hasError && "text-destructive")}
      >
        {tratamiento.name}
      </Text>
    </CaptureChip>
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
