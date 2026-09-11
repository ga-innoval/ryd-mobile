import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  CheckIcon,
  ChevronDownIcon,
  type LucideIcon,
} from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

const TOGGLE_DURATION_MS = 180;

const styles = StyleSheet.create({
  // El recorte va en el estilo y no en un `className` porque este mismo
  // elemento lleva la altura animada: Reanimated y NativeWind se disputarían
  // la prop `style` si compartieran componente.
  clip: { overflow: "hidden" },
});

/**
 * Cabecera y cuerpo de una sección plegable, **como dos componentes sueltos y
 * no como uno solo**.
 *
 * No es una preferencia: `stickyHeaderIndices` de `ScrollView` indexa los hijos
 * directos del contenedor de scroll, y un Fragment cuenta como un hijo (no se
 * aplana). Para que la cabecera pueda quedarse fija al scrollear tiene que ser
 * un hijo de verdad, así que no puede haber una tarjeta que envuelva a las dos.
 *
 * De ahí sale también que el `open` viva en quien las monta: sin envoltorio no
 * hay dónde compartirlo. Por lo mismo se dejó `@rn-primitives/collapsible`, que
 * exige que su `Root` envuelva a Trigger y Content para pasarles contexto —
 * justo el envoltorio que no podemos tener. Lo que aportaba (el estado y tres
 * props de accesibilidad) se repone aquí a mano.
 *
 * Las dos animan sobre el mismo `open` y con la misma duración, así que arrancan
 * en el mismo commit y no se desincronizan aunque ya no compartan shared value.
 */

type CollapsibleHeaderProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  /**
   * Porcentaje completado (0-100). Omitirlo esconde la barra: el progreso es
   * cosa de quien monta la sección, no de la sección, o este componente
   * dejaría de servir para cualquier contenido que no sea una encuesta.
   */
  progress?: number;
  open: boolean;
  onToggle: () => void;
};

export function CollapsibleHeader({
  icon,
  title,
  description,
  progress,
  open,
  onToggle,
}: CollapsibleHeaderProps) {
  const expansion = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    expansion.value = withTiming(open ? 1 : 0, {
      duration: TOGGLE_DURATION_MS,
    });
  }, [open, expansion]);

  // El giro va en un `Animated.View` envolvente y el `className` en el `Icon`:
  // superponer Reanimated y NativeWind sobre el mismo componente hace que se
  // disputen la prop `style`.
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(expansion.value - 1) * 90}deg` }],
  }));

  return (
    // La separación va DENTRO del hijo que se pega, no como margen entre
    // hermanos: un margen exterior se scrollea con la sección anterior, y la
    // cabecera acabaría a ras del header de la página al quedarse fija. Así
    // sirve para las dos cosas — sin fijar es el hueco entre secciones, y
    // fijada es el aire bajo el header. Opaca a propósito: transparente se
    // vería el formulario pasando por esa franja.
    <View className="bg-background pt-4">
      <Pressable
        onPress={onToggle}
        role="button"
        aria-expanded={open}
        className={cn(
          "border-2 border-border bg-card overflow-hidden",
          // Cerrada es una tarjeta entera; abierta, solo la tapa de una que
          // continúa en el cuerpo.
          open ? "rounded-t-xl" : "rounded-xl",
        )}
      >
        <View className="flex-row items-center justify-between gap-2 bg-secondary px-4 py-3">
          <View className="gap-1">
            <View className="flex-row gap-2 items-center">
              <Icon as={icon} size={16} className="text-primary" />
              <Text className="font-bold flex-1">{title}</Text>
            </View>
            <Text variant="muted" className="text-base">
              {description}
            </Text>
          </View>

          <Animated.View style={chevronStyle}>
            <Icon as={ChevronDownIcon} size={18} className="text-primary" />
          </Animated.View>
        </View>

        {progress !== undefined && (
          <View className="flex-row items-center gap-4 bg-secondary px-4 pb-3">
            {/* `w-auto` neutraliza el `w-full` que trae la raíz de `Progress`:
                en una fila ocupaba el ancho entero y, como en React Native el
                `flexShrink` por defecto es 0, empujaba el porcentaje fuera del
                borde de la tarjeta. Al ir por `cn` -> `twMerge`, la clase de
                fuera reemplaza a la interna en vez de competir con ella. */}
            <Progress
              value={progress}
              className="w-auto flex-1 bg-white"
              indicatorClassName={cn("bg-foreground/90")}
            />
            {/* Ancho mínimo para que la barra no dé un tirón al pasar de
                "0%" a "100%", y alineado a la derecha para que el número
                quede a ras del borde de la tarjeta. */}
            <Text className="min-w-12 text-right font-medium">{progress}%</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

type CollapsibleBodyProps = {
  open: boolean;
  children: ReactNode;
};

/**
 * **El contenido no se desmonta al cerrar.** Se monta la primera vez que se
 * abre y a partir de ahí solo se pliega: reconstruirlo en cada apertura costaba
 * un commit síncrono con decenas de shared values y animated styles, y esa era
 * la espera perceptible al expandir. El precio es que una sección cerrada sigue
 * ocupando su parte del árbol de vistas y participando en los layouts.
 *
 * Consecuencia útil: el estado que viva dentro del contenido sobrevive al
 * plegado.
 */
export function CollapsibleBody({ open, children }: CollapsibleBodyProps) {
  // Lo que nunca se abre no se monta; lo que se abre no se vuelve a desmontar.
  const [hasMounted, setHasMounted] = useState(open);
  useEffect(() => {
    if (open) setHasMounted(true);
  }, [open]);

  // La altura hay que medirla: no se puede animar hacia `auto`. Mientras no
  // haya medida vale 0, y eso deja el contenido recortado a nada — que es
  // justamente lo que se quiere hasta saber a dónde animar.
  const [contentHeight, setContentHeight] = useState(0);
  const isMeasured = contentHeight > 0;

  const expansion = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    // Sin medida no hay a dónde animar, y el contenido está recortado a 0 —
    // invisible, no a medio dibujar. `isMeasured` es dependencia, así que esto
    // vuelve a correr en cuanto `onLayout` trae la altura, y es entonces cuando
    // arranca la animación. Por eso la primera apertura también va animada.
    if (!isMeasured) return;

    expansion.value = withTiming(open ? 1 : 0, {
      duration: TOGGLE_DURATION_MS,
    });
  }, [open, isMeasured, expansion]);

  // Solo altura, sin `opacity`. El recorte ya oculta el contenido, y en Android
  // aplicar alpha a una vista con hijos la compone en un buffer fuera de
  // pantalla del tamaño de la vista: aquí, el alto entero del formulario.
  const contentStyle = useAnimatedStyle(() => ({
    height: expansion.value * contentHeight,
  }));

  return (
    <View
      role="region"
      aria-hidden={!open}
      className="overflow-hidden rounded-b-xl"
    >
      {hasMounted && (
        <Animated.View style={[styles.clip, contentStyle]}>
          {/* Fondo y bordes van aquí dentro y con `inset-0`, no en el
              contenedor de fuera. Su caja es entonces la del contenedor
              animado, así que encogen con él y se van a la vez que el
              contenido; colgados de `open` desaparecían en el frame del toque,
              con la animación a medias. Y al llegar a 0 su alto es exactamente
              0 —no 0 más el borde, como pasaría en un contenedor de alto
              automático—, así que tampoco dejan una raya bajo la cabecera. */}
          <View className="absolute inset-0 rounded-b-xl border-x-2 border-b-2 border-border bg-card" />
          {/* Absoluto desde el primer render, y por dos razones distintas.
              En flujo, el contenedor tomaría el alto natural del contenido
              mientras no hay medida, y Android maquetaría y dibujaría el
              formulario entero antes de plegarlo: ese era el flash de la
              primera apertura. Y en flujo, al plegar, Yoga volvería a medir el
              hijo contra la altura impuesta del padre y `onLayout` pisaría la
              medición buena con un valor recortado — la sección reabría a unos
              pocos píxeles. Absoluto con `top/left/right` se dimensiona por su
              contenido y no ve la altura del padre. */}
          <View
            className="absolute left-0 right-0 top-0 px-4 py-4"
            onLayout={(e) => {
              const { height } = e.nativeEvent.layout;
              // Un 0 volvería a `isMeasured` falso: el contenido quedaría
              // recortado a nada y el efecto dejaría de animar, sin que nada
              // lo sacara de ahí.
              if (height > 0) setContentHeight(height);
            }}
          >
            {children}
          </View>
        </Animated.View>
      )}
    </View>
  );
}
