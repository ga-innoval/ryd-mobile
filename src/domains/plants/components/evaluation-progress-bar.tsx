import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { useEvaluationSaveStore } from "../store/evaluation-save-store";

const styles = StyleSheet.create({
  // El porcentaje cambia mientras se captura, y sin cifras de ancho fijo la
  // barra se movería al pasar de "8 %" a "11 %". `tabular-nums` es clase de
  // Tailwind pero **no hace nada en nativo** —react-native-css-interop no
  // traduce `font-variant-numeric`— y falla en silencio, así que va por `style`.
  tabular: { fontVariant: ["tabular-nums"] },
});

/**
 * El avance de la evaluación, al pie del bloque de la cabecera.
 *
 * La usan las dos pantallas de captura —tratamiento y post-cosecha—: es la misma
 * barra, del mismo store y con los mismos estilos, y de dos copias saldrían dos
 * verdes y dos formas de redondear el porcentaje.
 *
 * Se queda a la vista cuando el bloque se esconde: sube con él pero solo lo
 * justo para quedar bajo el header, que es lo que hace el `translateY` recortado
 * que recibe. Lleva su propio fondo verde porque al quedarse arriba, lo que pasa
 * por detrás es el formulario.
 *
 * **Su alto se mide, no se escribe.** Es lo que se le resta al desplazamiento
 * para que al pegarse caiga justo bajo el header, y lo que el bloque reserva
 * como padding para que esta fila no le tape los chips. Antes era una constante
 * de 8 px, que dejó de valer en cuanto el diseño le añadió la etiqueta y el
 * porcentaje; medirlo es lo que impide que el número vuelva a quedarse atrás
 * sin avisar.
 *
 * Lee el avance del store y no del formulario para no re-renderizar la pantalla
 * entera: la cabecera se pinta fuera de ella y este es el mismo camino.
 */
export function EvaluationProgressBar({
  style,
  onLayout,
}: {
  style: StyleProp<AnimatedStyle<ViewStyle>>;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const progress = useEvaluationSaveStore((state) => state.progress);

  return (
    <Animated.View
      pointerEvents="none"
      style={[style, { position: "absolute", left: 0, right: 0, bottom: 0 }]}
    >
      <View
        className="bg-primary flex-row items-center gap-3 px-4 py-3"
        onLayout={onLayout}
      >
        <Progress
          value={progress * 100}
          className="h-2 flex-1 rounded-full bg-primary-foreground/25"
          // El verde de siempre, no el del diseño: el artboard pinta la barra y
          // el punto de "Guardado" del mismo `green-300`, y en la app ese punto
          // es `leaf`. Seguir el artboard aquí habría metido un tercer verde.
          indicatorClassName="bg-white rounded-full"
        />
        <Text
          style={styles.tabular}
          className="min-w-11 text-right text-[15px] font-bold text-primary-foreground"
        >
          {Math.round(progress * 100)} %
        </Text>
      </View>
    </Animated.View>
  );
}
