import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import * as SliderPrimitive from "@rn-primitives/slider";
import { Text } from "@/components/ui/text";

/**
 * Mitad del diámetro de la manija. La pista se mete esto por cada lado para que
 * la manija no se salga del componente en los extremos, y es también el origen
 * desde el que se mide el arrastre.
 */
const THUMB = 32;
const INSET = THUMB / 2;

const TICKS = [0, 25, 50, 75, 100];

/**
 * Ancho reservado para la cifra, según si lleva decimal.
 *
 * Fijo porque **`tabular-nums` iguala el ancho de cada dígito, no cuántos hay**:
 * sin esto, pasar de «9» a «10» y de «99» a «100» empuja el `%` a un lado y el
 * bloque da un salto en mitad del arrastre.
 *
 * Y distinto por paso porque el peor caso no es el mismo: «100» son tres
 * caracteres y «100.0» son cinco. Con un ancho único, el decimal se recortaba y
 * se leía «100.» sin la cifra de detrás.
 */
const VALUE_WIDTH = { entero: 52, decimal: 76 };

/**
 * El hueco de la cifra, que es el mismo en los dos estados: ahí caben tanto
 * «100.0 %» como «Sin capturar», así que la fila no se mueve al capturar.
 */
const VALUE_SLOT_WIDTH = 104;

/**
 * Dónde descansa la manija mientras no hay dato.
 *
 * A un cuarto y no en el extremo izquierdo: ahí se confundía con un 0 % medido
 * —y encima quedaba encajonada contra el borde, incómoda de agarrar—. Al primer
 * toque salta al dedo, así que esta posición solo se ve antes de capturar.
 */
const EMPTY_PROGRESS = 0;

/** Lo que se le baja **al aro** de la manija mientras no haya dato. No se
 *  esconde —como en el artboard— porque es también la pista de que se puede
 *  arrastrar. */
const EMPTY_THUMB_OPACITY = 0.3;

/** El token `foreground` en hex: desde JS no hay forma de leer
 *  `tailwind.config`, y esta cifra la pinta Reanimated por `style`. */
const FOREGROUND = "#1c2e1a";

const styles = StyleSheet.create({
  slot: {
    width: VALUE_SLOT_WIDTH,
    height: 28,
  },
  // Los dos estados ocupan el mismo sitio y se cruzan por opacidad, así que
  // cambiar de uno a otro no mueve nada de la fila.
  stateRow: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  value: {
    padding: 0,
    // Alto explícito: el de un `TextInput` no sale de `lineHeight`, y sin esto
    // la fila crece y la cifra se desalinea del `%` que lleva al lado.
    height: 28,
    textAlign: "right",
    fontSize: 22,
    lineHeight: 28,
    color: FOREGROUND,
    fontWeight: 600,
    // Cifras de ancho fijo. `tabular-nums` como clase de Tailwind **no hace
    // nada en nativo** —react-native-css-interop no traduce
    // `font-variant-numeric`—, así que va por `style`.
    fontVariant: ["tabular-nums"],
  },
  tabular: { fontVariant: ["tabular-nums"] },
});

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Redondea al paso y lo deja dentro de 0–100. Worklet: corre en el hilo de la
 *  interfaz durante el arrastre. */
function snap(value: number, step: number): number {
  "worklet";
  const clamped = Math.min(100, Math.max(0, value));
  const snapped = Math.round(clamped / step) * step;

  // El paso de 0.5 arrastra el error binario (0.1+0.2), así que se recorta al
  // decimal que el paso admite en vez de dejar "12.300000000000001".
  return Number(snapped.toFixed(step < 1 ? 1 : 0));
}

type PercentSliderProps = {
  label: string;
  /** De 0 a 100, o `undefined` mientras nadie lo haya tocado. */
  value?: number;
  onChange: (value: number) => void;
  /** 0.5 en los que admiten medio punto, 1 en los enteros. */
  step?: number;
};

/**
 * Un porcentaje de 0 a 100, capturado arrastrando.
 *
 * **El número es de solo lectura.** No hay teclado: en campo, con guantes, la
 * barra es más rápida que teclear, y el paso evita los decimales imposibles.
 *
 * **Distingue «sin capturar» de «0 %»**, que no es lo mismo: un cero medido es
 * un dato y un campo que nadie tocó, no. Sin esa distinción las tres preguntas
 * de porcentaje contaban como contestadas desde el primer frame, y una
 * evaluación recién abierta ya enseñaba un 25 % de avance que nadie había
 * capturado.
 *
 * Mientras no hay dato, la manija baja de opacidad y la cifra cede su sitio a
 * «Sin capturar». **La pista no cambia** —el artboard la pone punteada; aquí se
 * queda igual—, y la manija se atenúa en vez de esconderse: es también la pista
 * de que eso se arrastra.
 *
 * **El cambio de estado ocurre al empezar el gesto, no al soltar**, y por eso
 * viaja en un shared value: con estado de React habría que esperar al `onEnd`
 * para que React repintara, y arrastrando se vería «Sin capturar» hasta
 * levantar el dedo. Un toque suelto también captura —el gesto admite distancia
 * cero—, que es como se registra un 0 % de verdad.
 *
 * **El arrastre entero vive en el hilo de la interfaz.** La manija, el relleno y
 * la cifra salen de un `useSharedValue`, y a React se le avisa **al soltar**.
 * Antes se le avisaba en cada frame, y como el padre repinta las once preguntas
 * de la sección, el número avanzaba a tirones: no iba demasiado rápido, iba
 * perdiendo frames.
 *
 * **Y por eso tampoco lleva `withTiming`**: interpolar la cifra la dejaría
 * retrasada respecto al dedo —manija en 40, número diciendo 32—, que se siente
 * peor que el salto que se quería quitar. Lo que hacía falta era que no se
 * perdieran frames, no que los valores se suavizaran.
 *
 * Monta el primitivo de RNR por sus acciones de accesibilidad —incrementar y
 * decrementar con lector de pantalla—, pero el arrastre es nuestro: ese
 * primitivo es solo un contexto y no trae gesto.
 */
export function PercentSlider({
  label,
  value,
  onChange,
  step = 1,
}: PercentSliderProps) {
  const progress = useSharedValue(value ?? EMPTY_PROGRESS);

  /** 1 en cuanto hay dato —o en cuanto el dedo toca—, 0 mientras no. */
  const captured = useSharedValue(value === undefined ? 0 : 1);

  // El ancho útil de la pista, para pasar de píxeles a porcentaje. Se mide
  // porque depende del ancho de la tarjeta, que cambia con la orientación.
  const [trackWidth, setTrackWidth] = useState(0);

  // Lo que venga de fuera manda: sin esto, un reinicio del formulario dejaría
  // la manija donde la soltó el dedo.
  useEffect(() => {
    progress.value = value ?? EMPTY_PROGRESS;
    captured.value = value === undefined ? 0 : 1;
  }, [value, progress, captured]);

  const pan = Gesture.Pan()
    // `minDistance: 0` para que un toque suelto también posicione: en campo se
    // busca el valor tocando, no arrastrando desde el principio.
    .minDistance(0)
    .onBegin((e) => {
      if (trackWidth <= 0) return;
      // Tocar ya es capturar: de aquí no se vuelve a «sin capturar».
      captured.value = 1;
      progress.value = snap((e.x / trackWidth) * 100, step);
    })
    .onUpdate((e) => {
      if (trackWidth <= 0) return;
      progress.value = snap((e.x / trackWidth) * 100, step);
    })
    // Una sola vez, al soltar: es cuando el dato deja de ser un gesto en curso
    // y pasa a ser una respuesta.
    .onEnd(() => runOnJS(onChange)(progress.value));

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
    // Sin dato no hay relleno: con la manija descansando en el 25 %, pintar su
    // cuarto de pista se leería como un 25 % medido, que es justo lo que este
    // estado existe para no decir.
    opacity: captured.value,
  }));

  /**
   * En píxeles sobre el recorrido de la pista, **no en `%` del contenedor**.
   *
   * La pista va metida `INSET` por cada lado, así que el recorrido de la manija
   * es `trackWidth`, no el ancho entero. Con `left: 100%` su borde izquierdo
   * caía en el extremo y los 32 px de la manija quedaban fuera del componente.
   * Es la misma regla con la que se lee el dedo en `onUpdate`: medir y pintar
   * tienen que usar la misma.
   */
  const thumbStyle = useAnimatedStyle(() => ({
    left: (progress.value / 100) * trackWidth,
  }));

  /**
   * **Se atenúa el aro, no la manija entera.** Bajándole la opacidad al `View`
   * que lleva el relleno, el blanco se vuelve translúcido y la pista se ve por
   * debajo: la manija parecía un agujero. Por eso el aro va en su propia capa.
   */
  const thumbRingStyle = useAnimatedStyle(() => ({
    opacity: captured.value === 1 ? 1 : EMPTY_THUMB_OPACITY,
  }));

  /** Los dos estados de la cifra, cruzándose. Sin `withTiming`: el evaluador
   *  acaba de tocar y la respuesta tiene que ser del mismo frame. */
  const capturedStyle = useAnimatedStyle(() => ({ opacity: captured.value }));
  const emptyStyle = useAnimatedStyle(() => ({ opacity: 1 - captured.value }));

  const valueProps = useAnimatedProps(() => {
    const text = progress.value.toFixed(step < 1 ? 1 : 0);

    // `text` no está en los tipos de `TextInput`: es la vía por la que
    // Reanimated escribe sin pasar por React, de ahí el `as never`.
    return { text, defaultValue: text } as never;
  });

  return (
    <SliderPrimitive.Root
      // El primitivo no sabe de «sin capturar»: para el lector de pantalla, una
      // barra sin tocar está en su mínimo, y leerla no la captura.
      value={value ?? 0}
      min={0}
      max={100}
      step={step}
      // El primitivo entrega un array porque admite varias manijas; aquí solo
      // hay una. Esto es el camino del lector de pantalla, no del dedo.
      onValueChange={([next]) =>
        next !== undefined && onChange(snap(next, step))
      }
      className="gap-1.5"
    >
      {/* `items-center` y no `items-baseline`: el hueco de la cifra solo
          contiene hijos absolutos, así que no tiene baseline que ofrecer y la
          etiqueta se iría arriba. (Tampoco la tenía antes: la baseline de un
          `TextInput` no es la de su texto, y el `%` quedaba descolgado.) */}
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="muted">{label}</Text>
        {/* Los dos estados comparten hueco y se cruzan por opacidad, así que
            capturar no mueve ni la etiqueta ni la cifra. */}
        <View style={styles.slot}>
          <Animated.View style={[styles.stateRow, capturedStyle]}>
            <AnimatedTextInput
              animatedProps={valueProps}
              defaultValue={String(value ?? 0)}
              editable={false}
              // Es una cifra que se lee, no un campo: sin esto el lector de
              // pantalla la anunciaría como editable.
              accessible={false}
              style={[
                styles.value,
                { width: VALUE_WIDTH[step < 1 ? "decimal" : "entero"] },
              ]}
            />
            <Text className="text-[15px] font-semibold">%</Text>
          </Animated.View>

          <Animated.View style={[styles.stateRow, emptyStyle]}>
            <Text className="text-[15px] text-muted-foreground">
              Sin capturar
            </Text>
          </Animated.View>
        </View>
      </View>

      <GestureDetector gesture={pan}>
        {/* El alto es el de la manija aunque la pista sea fina: es la zona que
            recibe el dedo, y con 10 px sería imposible de acertar. */}
        <View
          style={{ height: THUMB }}
          className="justify-center"
          onLayout={(e) =>
            setTrackWidth(Math.max(0, e.nativeEvent.layout.width - THUMB))
          }
        >
          <View
            style={{ marginHorizontal: INSET }}
            className="h-2.5 justify-center rounded-full bg-foreground/10"
          >
            <Animated.View
              style={fillStyle}
              className="h-2.5 rounded-full bg-foreground/90"
            />
          </View>

          <Animated.View
            style={[thumbStyle, { width: THUMB, height: THUMB }]}
            className="absolute rounded-full bg-white shadow-sm shadow-black/25"
          >
            <Animated.View
              style={thumbRingStyle}
              className="absolute inset-0 rounded-full border-[3px] border-foreground"
            />
          </Animated.View>
        </View>
      </GestureDetector>

      <View className="flex-row items-center justify-between px-4">
        {TICKS.map((tick) => (
          <Text
            key={tick}
            style={styles.tabular}
            className="text-[13px] text-muted-foreground"
          >
            {tick}
          </Text>
        ))}
      </View>
    </SliderPrimitive.Root>
  );
}
