import { View } from "react-native";
import Animated from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import { cn } from "@/lib/utils";
import { CircleCheckIcon, CircleXIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { isComplete } from "../lib/evaluation-progress";
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
    container: "w-28 h-[72px] px-2.5",
    text: "max-w-24",
    activeContainer: "bg-primary border-primary",
    activeText: "text-primary-foreground",
  },
  // Más pequeño y con borde claro, porque va sobre `bg-primary`.
  header: {
    container: "w-28 h-10 px-2 border",
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

/**
 * De qué color va el borde, que es lo que dice el estado de la captura cuando el
 * chip todavía está vacío —el relleno ahí no se ve—.
 *
 * Las preguntas van en este orden a propósito:
 *
 * 1. **La cabecera no opina del avance.** Allí el chip solo sitúa en cuál
 *    estás, y el avance ya está a la vista en las propias secciones.
 * 2. **El error manda sobre el avance.** Es lo que hay que ver aunque la
 *    captura vaya muy adelantada, y es lo que promete la prop: decirlo sin
 *    abrirlo.
 * 3. **Empezada o sin empezar**, que es lo que queda.
 */
function borderClassName({
  variant,
  progress,
  hasError,
}: {
  variant: ChipVariant;
  progress: number;
  hasError: boolean;
}): string {
  if (variant === "header") return "border-primary-foreground/50";

  return "border-border";
}

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
        // **Sin `overflow-hidden`**: el check se monta sobre la esquina y aquí
        // se le recortaría. El relleno no lo echa de menos —se recorta en su
        // propia capa— y el nombre tampoco, que trunca con `numberOfLines`.
        "rounded-xl items-center justify-center border-2 flex-col",
        styles.container,
        borderClassName({ variant, progress, hasError }),
        // Después del borde de estado y no antes: el chip abierto tiene que
        // verse abierto por encima de lo que diga su captura.
        isActive && styles.activeContainer,
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
        //
        // **El relleno va en dos capas, y no es adorno.** El `%` de un hijo
        // absoluto no se mide igual en CSS que en Yoga: allí es contra la caja
        // de padding del padre —por eso el mockup se ve lleno— y aquí contra la
        // de contenido, así que con `px-2.5` un 100 % cubría 88 de los 112 px y
        // una captura completa se veía al 78 %.
        //
        // La de fuera se estira con `inset-0`, que no depende de ningún
        // porcentaje; como no tiene padding ni borde, el `%` de la de dentro ya
        // mide contra el ancho entero.
        //
        // El `rounded-[10px]` es la curva **interior**: la del chip menos su
        // borde (12 − 2). Sin él las esquinas del relleno son rectas y se meten
        // en la cuña que deja la curva, pintándose encima del borde y
        // desdibujándolo — se ve en cuanto el relleno no llega al 100 %.
        <View
          pointerEvents="none"
          className="absolute inset-0 overflow-hidden rounded-[10px]"
        >
          <View
            style={{ width: `${progress * 100}%` }}
            className={cn(
              "h-full",
              // Con un dato imposible el chip ya está en rojo; un relleno verde
              // encima lo dejaría de dos colores sin querer decir nada nuevo.
              hasError ? "bg-destructive/15" : "bg-leaf/20 ",
            )}
          />
        </View>
      )}

      {/* Una sola señal en la esquina, y **el error gana**: una captura llena
          con un dato imposible no está terminada —es justo lo que el error
          impide—, así que enseñar las dos, o solo la palomita, diría lo
          contrario. En la cabecera no va ninguna: allí el chip solo sitúa en
          cuál estás. */}
      {variant === "card" && (hasError || isComplete(progress)) && (
        <View pointerEvents="none" className="absolute -right-1.5 -top-1.5">
          <Icon
            as={hasError ? CircleXIcon : CircleCheckIcon}
            size={20}
            strokeWidth={1.8}
            className={hasError ? "text-destructive" : "text-leaf"}
          />
        </View>
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
