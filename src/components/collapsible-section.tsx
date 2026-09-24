import { useEffect, useState, type ReactNode } from "react";
import {
  AppState,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
// El de gesture-handler y no el de React Native: ver la cabecera.
import { Pressable as GesturePressable } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ChevronDownIcon, type LucideIcon } from "lucide-react-native";
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
  /**
   * Contenido libre en el lugar de la barra, para secciones cuyo avance no es
   * un porcentaje: Brix no tiene un número fijo de cortes, así que muestra
   * cuántos lleva y su promedio, y Criba resume el peso de la muestra.
   */
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  /**
   * Solo el alto es fiable: siendo sticky, `ScrollView` envuelve la cabecera
   * en su propio componente y la `y` que llega es relativa a ese envoltorio.
   */
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * El chevron de toda cabecera plegable: a la derecha cerrada, hacia abajo
 * abierta.
 *
 * Suelto para que la cabecera de sección y la de cada corte de Brix giren igual
 * sin repetir la animación. Comparte duración con `CollapsibleBody`, así que el
 * giro y el pliegue terminan a la vez.
 */
export function CollapsibleChevron({ open }: { open: boolean }) {
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
    <Animated.View style={chevronStyle}>
      <Icon as={ChevronDownIcon} size={18} className="text-primary" />
    </Animated.View>
  );
}

export function CollapsibleHeader({
  icon,
  title,
  description,
  progress,
  summary,
  open,
  onToggle,
  onLayout,
}: CollapsibleHeaderProps) {
  return (
    // La separación va DENTRO del hijo que se pega, no como margen entre
    // hermanos: un margen exterior se scrollea con la sección anterior, y la
    // cabecera acabaría a ras del header de la página al quedarse fija. Así
    // sirve para las dos cosas — sin fijar es el hueco entre secciones, y
    // fijada es el aire bajo el header. Opaca a propósito: transparente se
    // vería el formulario pasando por esa franja.
    <View className="bg-background pt-4" onLayout={onLayout}>
      {/* **`Pressable` de gesture-handler, no el de React Native**, y solo
          aquí: es el único que vive en una cabecera sticky.

          El sticky se desplaza con un driver nativo que no pasa por el árbol
          de sombras, así que `measure()` devuelve la posición de la cabecera
          como si no estuviera pegada — medido en una Lenovo: dedo en y=160,
          cabecera según `measure()` en -768…-652. El `Pressable` de React
          Native compara con esa medida en cuanto el dedo se mueve, y una
          pantalla física de Android se mueve algo incluso en un toque limpio:
          concluía que el dedo había salido y no disparaba `onPress`. En el
          simulador se toca con el ratón, sin movimiento, y no se notaba.

          El de gesture-handler compara coordenadas locales que calcula el
          orquestador nativo, con el transform ya aplicado, contra el tamaño
          de `onLayout`: el desplazamiento del sticky le da igual. Y si el
          scroll arranca sobre la cabecera, el toque llega cancelado y no
          dispara `onPress`, así que desplazarse no la pliega. */}
      <GesturePressable onPress={onToggle} role="button" aria-expanded={open}>
        {/* **La tarjeta —borde, blanco y radio— va en una `View` normal, no en
            el botón.** En Android, el botón de gesture-handler pinta su borde
            con un trazo centrado sobre su contorno (`Paint.Style.STROKE` en
            `createBorderDrawable`), así que la mitad le queda fuera. Arriba no
            se notaba; abajo, esa mitad caía bajo la franja opaca de la cabecera
            siguiente, y el borde inferior de todas menos la última salía a
            medias. Las vistas de React Native lo dibujan entero hacia dentro,
            como el cuerpo de la sección, así que la unión queda con el mismo
            trazo. El botón se queda solo con el toque. */}
        <View
          className={cn(
            // Sin `overflow-hidden`: no hay nada que recortar —el verde ya
            // viene redondeado—, y con él iOS dibujaba cerrada y abierta por
            // caminos distintos (ver el contenedor de dentro).
            "border-2 border-border bg-card",
            // Cerrada es una tarjeta entera; abierta, solo la tapa de una que
            // continúa en el cuerpo.
            //
            // **Las cuatro esquinas siempre, y no `rounded-xl` ↔
            // `rounded-t-xl`.** Parece redundante y no lo es: así el estilo
            // lleva las mismas claves en los dos estados y plegar solo cambia
            // el valor de las de abajo. Alternar entre el radio general y los
            // de cada esquina obliga a quitar claves al volver, y en Android
            // eso dejaba la cabecera sin redondear tras el primer abrir y
            // cerrar.
            "rounded-t-xl",
            open ? "rounded-b-none" : "rounded-b-xl",
          )}
        >
          {/* **Todo el verde en un solo contenedor redondeado al radio interior
            del borde, y no en cada fila.**

            Con el fondo en las filas, sus esquinas rectas se metían en la
            franja curva del borde, y como el borde es translúcido lo que tiene
            debajo se nota. iOS además lo dibuja de dos formas: con radios
            iguales y recorte, delante del contenido —cerrada: el borde sobre
            verde en las esquinas, más oscuro, parecía más grueso—; con radios
            distintos, detrás —abierta: el verde lo tapaba y el borde
            desaparecía en las esquinas—. `RCTViewComponentView.mm` elige entre
            los dos.

            Así, bajo el borde queda siempre el blanco de la tarjeta, igual que
            en el cuerpo, y el tono no cambia en la unión.

            El 10 es `rounded-xl` (12) menos `border-2` (2): si cambia el radio
            o el grosor, tiene que moverse con ellos. */}
          <View
            className={cn(
              // Las cuatro esquinas explícitas por lo mismo que en la tarjeta.
              "bg-secondary rounded-t-[10px]",
              open ? "rounded-b-none" : "rounded-b-[10px]",
            )}
          >
            <View className="flex-row items-center justify-between gap-2 px-4 py-3">
              <View className="gap-1">
                <View className="flex-row gap-2 items-center">
                  <Icon as={icon} size={16} className="text-primary" />
                  <Text className="font-bold flex-1">{title}</Text>
                </View>
                <Text variant="muted" className="text-base">
                  {description}
                </Text>
              </View>

              <CollapsibleChevron open={open} />
            </View>

            {progress !== undefined && (
              <View className="flex-row items-center gap-4 px-4 pb-3">
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
                <Text className="min-w-12 text-right font-medium">
                  {progress}%
                </Text>
              </View>
            )}

            {summary !== undefined && (
              <View className="px-4 pb-3">{summary}</View>
            )}
          </View>
        </View>
      </GesturePressable>
    </View>
  );
}

type CollapsibleBodyProps = {
  open: boolean;
  children: ReactNode;
  /** El cuerpo no es sticky: su `y` sí es relativa al contenido del scroll. */
  onLayout?: (event: LayoutChangeEvent) => void;
  /**
   * `section` continúa la tarjeta de `CollapsibleHeader`: fondo, bordes y
   * padding. `bare` solo pliega, sin aspecto propio, para contenido que ya va
   * dentro de su propia tarjeta, como cada corte de Brix.
   */
  variant?: "section" | "bare";
};

/**
 * **La altura del cuerpo sale únicamente del estilo animado.** Sus dos hijos
 * —el fondo y el contenido medible— son `position: absolute`, así que el
 * contenedor no tiene altura propia: si Reanimated deja de aplicar su estilo,
 * no cae a "auto" mostrando el contenido, cae a **0** y se ve idéntico a
 * cerrado. Es la razón del `AppState` de abajo, y conviene tenerlo presente
 * antes de tocar el posicionamiento.
 *
 * **El contenido no se desmonta al cerrar.** Se monta la primera vez que se
 * abre y a partir de ahí solo se pliega: reconstruirlo en cada apertura costaba
 * un commit síncrono con decenas de shared values y animated styles, y esa era
 * la espera perceptible al expandir. El precio es que una sección cerrada sigue
 * ocupando su parte del árbol de vistas y participando en los layouts.
 *
 * Consecuencia útil: el estado que viva dentro del contenido sobrevive al
 * plegado.
 */
export function CollapsibleBody({
  open,
  children,
  onLayout,
  variant = "section",
}: CollapsibleBodyProps) {
  const isSection = variant === "section";

  // Lo que nunca se abre no se monta; lo que se abre no se vuelve a desmontar.
  const [hasMounted, setHasMounted] = useState(open);
  useEffect(() => {
    // Es un pestillo de montaje, no un cálculo: el render de más es justamente
    // el que monta el contenido la primera vez que se abre.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setHasMounted(true);
  }, [open]);

  // La altura hay que medirla: no se puede animar hacia `auto`. Mientras no
  // haya medida vale 0, y eso deja el contenido recortado a nada — que es
  // justamente lo que se quiere hasta saber a dónde animar.
  const [contentHeight, setContentHeight] = useState(0);
  const isMeasured = contentHeight > 0;

  const expansion = useSharedValue(open ? 1 : 0);

  /**
   * Android tira el estilo aplicado por Reanimated al volver de una Activity
   * de sistema —el picker de fotos—, y como la altura solo viene de ahí, el
   * cuerpo colapsa a 0 aunque `open` siga siendo `true`. Esto lo vuelve a
   * escribir.
   *
   * Medido, no supuesto: al volver, el shared value seguía valiendo 1 con la
   * sección viéndose cerrada. Lo que se pierde es la escritura en la vista,
   * no el valor — de ahí que baste con reaplicarlo.
   *
   * Va con `withTiming` y no con una asignación directa a propósito: asignar
   * el mismo número puede no disparar ninguna escritura, y lo que hace falta
   * aquí es justamente que la escriba. Si el estilo no se había perdido,
   * animar de 1 a 1 no se ve.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;

      expansion.value = withTiming(open ? 1 : 0, {
        duration: TOGGLE_DURATION_MS,
      });
    });

    return () => subscription.remove();
  }, [open, expansion]);

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
      className={cn("overflow-hidden", isSection && "rounded-b-xl")}
      onLayout={onLayout}
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
          {isSection && (
            <View className="absolute inset-0 rounded-b-xl border-x-2 border-b-2 border-border bg-card" />
          )}
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
            className={cn(
              "absolute left-0 right-0 top-0",
              isSection && "px-4 py-4",
            )}
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
