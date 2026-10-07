import type { ReactNode } from "react";
import { View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { PressableScale } from "@/components/ui/pressable-scale";
import { cn } from "@/lib/utils";

/** La señal de la esquina: qué icono, de qué color y sobre qué fondo. */
export type CaptureChipBadge = {
  icon: LucideIcon;
  /** El color del trazo, por clase. */
  className: string;
  /**
   * El relleno del círculo, en hex. **Es el fondo del renglón**, no un color
   * propio: la señal se monta sobre la esquina y sin relleno se le vería el
   * borde del chip cruzado por detrás. Desde JS no hay forma de leer
   * `tailwind.config`, así que va en hex.
   */
  fill: string;
};

type CaptureChipProps = {
  onPress: () => void;
  /** Lo capturado, de 0 a 1: es lo que llena el chip. */
  progress?: number;
  /** El color del relleno, que cada captura decide. */
  fillClassName?: string;
  badge?: CaptureChipBadge;
  /** Para el borde o el fondo, cuando una captura quiera marcarse. */
  className?: string;
  accessibilityLabel?: string;
  testID?: string;
  children: ReactNode;
};

/**
 * La caja de una captura en la tarjeta de plantación: un tratamiento o una de
 * las cuatro evaluaciones de post-cosecha.
 *
 * Existe porque las dos son **la misma caja**: mismo tamaño, mismo relleno de
 * avance y misma señal en la esquina. Lo que cambia es lo de dentro —un nombre
 * o unos días con su empaque—, de qué color se llena y qué dice la esquina, y
 * eso lo pone quien la monta. Los chips de las cabeceras no pasan por aquí: no
 * llevan avance ni señal, y allí el chip solo sitúa en cuál estás.
 *
 * **Sin `overflow-hidden`**: la señal se monta sobre la esquina y aquí se le
 * recortaría. El relleno no lo echa de menos —se recorta en su propia capa— y
 * las etiquetas tampoco, que truncan con `numberOfLines`.
 */
export function CaptureChip({
  onPress,
  progress = 0,
  fillClassName,
  badge,
  className,
  accessibilityLabel,
  testID,
  children,
}: CaptureChipProps) {
  return (
    <PressableScale
      onPress={onPress}
      testID={testID}
      role="button"
      aria-label={accessibilityLabel}
      className={cn(
        "h-[72px] w-28 flex-col items-center justify-center rounded-xl border-2 border-border px-2.5",
        className,
      )}
    >
      {/* **El avance llena el chip, no lleva barra** (opción C del artboard).
          Con una barra al pie, un chip de 112 px reparte su alto entre el texto
          y una línea de 4 px que hay que ir a buscar; llenándolo, el avance se
          lee sin mirar ningún sitio en concreto.

          Va declarado **antes** que el contenido y sin `zIndex`: en React
          Native pinta encima lo que se declara después, así que el orden basta.

          **Las dos capas no son adorno.** El `%` de un hijo absoluto no se mide
          igual en CSS que en Yoga: allí es contra la caja de padding del padre
          —por eso el mockup se ve lleno— y aquí contra la de contenido, así que
          con `px-2.5` un 100 % cubría 88 de los 112 px y una captura completa se
          veía al 78 %. La de fuera se estira con `inset-0`, que no depende de
          ningún porcentaje; como no tiene padding ni borde, el `%` de la de
          dentro ya mide contra el ancho entero.

          El `rounded-[10px]` es la curva **interior**: la del chip menos su
          borde (12 − 2). Sin él las esquinas del relleno son rectas y se meten
          en la cuña que deja la curva, pintándose encima del borde y
          desdibujándolo — se ve en cuanto el relleno no llega al 100 %. */}
      <View
        pointerEvents="none"
        className="absolute inset-0 overflow-hidden rounded-[10px]"
      >
        <View
          style={{ width: `${progress * 100}%` }}
          className={cn("h-full", fillClassName)}
        />
      </View>

      {children}

      {badge && (
        <View pointerEvents="none" className="absolute -right-1.5 -top-1.5">
          <Icon
            as={badge.icon}
            size={20}
            strokeWidth={1.8}
            fill={badge.fill}
            className={badge.className}
          />
        </View>
      )}
    </PressableScale>
  );
}
