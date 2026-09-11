import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ChevronDownIcon, type LucideIcon } from "lucide-react-native";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

type CollapsibleSectionProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  /**
   * Porcentaje completado (0-100). Omitirlo esconde la barra: el progreso es
   * cosa de quien monta la sección, no de la sección, o este componente
   * dejaría de servir para cualquier contenido que no sea una encuesta.
   */
  progress?: number;
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * Tarjeta con cabecera de color y cuerpo plegable, para las secciones del
 * formulario de evaluación.
 *
 * Se controla el `open` desde aquí en vez de dejarlo al primitivo porque el
 * chevron y la altura necesitan conocer el estado para animarse.
 *
 * **El contenido no se desmonta al cerrar**, que es justo lo contrario de lo
 * que hace `CollapsibleContent` por defecto: devuelve `null` salvo que reciba
 * `forceMount`. Reconstruir el formulario en cada apertura cuesta un commit
 * síncrono con decenas de shared values y animated styles, y esa era la espera
 * perceptible al expandir. Aquí se monta la primera vez que se abre y a partir
 * de ahí solo se pliega. El precio es que una sección cerrada sigue ocupando
 * su parte del árbol de vistas y participando en los layouts.
 *
 * Consecuencia útil: el estado que viva dentro del contenido ya sobrevive al
 * plegado.
 */
export function CollapsibleSection({
  icon,
  title,
  description,
  progress,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Lo que nunca se abre no se monta; lo que se abre no se vuelve a desmontar.
  const [hasMounted, setHasMounted] = useState(defaultOpen);
  useEffect(() => {
    if (open) setHasMounted(true);
  }, [open]);

  // La altura hay que medirla: no se puede animar hacia `auto`.
  //
  // Y hay que medirla **fuera del flujo**. Si el contenido cuelga en flujo
  // normal del contenedor animado, al plegar Yoga lo vuelve a medir contra la
  // altura impuesta del padre, `onLayout` dispara con ese valor recortado y
  // pisa la medición buena: la sección reabría a unos pocos píxeles. Un hijo
  // absoluto con `top/left/right` y alto automático se dimensiona por su
  // contenido y no ve la altura del padre, así que mide siempre lo mismo.
  const [contentHeight, setContentHeight] = useState(0);
  const isMeasured = contentHeight > 0;

  // Cuánto está desplegada la sección: 0 cerrada, 1 abierta. No confundir con
  // el prop `progress`, que es el avance de la encuesta.
  const expansion = useSharedValue(defaultOpen ? 1 : 0);

  useEffect(() => {
    if (!isMeasured) {
      // Primera apertura de una sección que nació cerrada: todavía no hay
      // altura conocida, así que esta vez se abre de golpe. A partir de aquí
      // queda medida y montada, y el resto de plegados sí se animan.
      expansion.value = open ? 1 : 0;
      return;
    }
    expansion.value = withTiming(open ? 1 : 0, {
      duration: TOGGLE_DURATION_MS,
    });
  }, [open, isMeasured, expansion]);

  // Chevron y cuerpo comparten `expansion` para que giren y se plieguen al
  // mismo ritmo: a 1 apunta hacia abajo, a 0 hacia la derecha.
  //
  // El giro va en un `Animated.View` envolvente y el `className` en el `Icon`:
  // superponer Reanimated y NativeWind sobre el mismo componente hace que se
  // disputen la prop `style`.
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(expansion.value - 1) * 90}deg` }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    height: expansion.value * contentHeight,
    opacity: expansion.value,
  }));

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <View className="rounded-xl border-2 border-border bg-card overflow-hidden">
        <CollapsibleTrigger>
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
            <View className="flex-row items-center gap-4 px-4 py-3">
              {/* `w-auto` neutraliza el `w-full` que trae la raíz de `Progress`:
                  en una fila ocupaba el ancho entero y, como en React Native el
                  `flexShrink` por defecto es 0, empujaba el porcentaje fuera
                  del borde de la tarjeta. Al ir por `cn` -> `twMerge`, la clase
                  de fuera reemplaza a la interna en vez de competir con ella. */}
              <Progress
                value={progress}
                className="w-auto flex-1 bg-background"
                indicatorClassName="bg-foreground/90"
              />
              {/* Ancho mínimo para que la barra no dé un tirón al pasar de
                  "0%" a "100%", y alineado a la derecha para que el número
                  quede a ras del borde de la tarjeta. */}
              <Text className="min-w-12 text-right">{progress}%</Text>
            </View>
          )}
        </CollapsibleTrigger>

        {/* Con `forceMount` el primitivo deja de calcular el `aria-hidden` (lo
            fija a `false`), así que hay que pasarlo a mano o un lector de
            pantalla leería una sección cerrada. Funciona porque el primitivo
            esparce `props` al final y gana el nuestro. */}
        <CollapsibleContent
          forceMount={hasMounted ? true : undefined}
          aria-hidden={!open}
        >
          <Animated.View
            style={[styles.clip, isMeasured ? contentStyle : undefined]}
          >
            {/* Se despega solo después de la primera medida: mientras no la hay,
                el contenedor no tiene altura que aplicar y necesita la del
                contenido en flujo, o la sección nacería en blanco. */}
            <View
              className={cn(
                "px-4 py-4",
                isMeasured && "absolute left-0 right-0 top-0",
              )}
              onLayout={(e) => {
                const { height } = e.nativeEvent.layout;
                // Un 0 volvería a `isMeasured` falso, devolvería el contenido
                // al flujo y arrancaría un ciclo de medidas.
                if (height > 0) setContentHeight(height);
              }}
            >
              {children}
            </View>
          </Animated.View>
        </CollapsibleContent>
      </View>
    </Collapsible>
  );
}
