import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const DEFAULT_THRESHOLD_PX = 24;
const DEFAULT_DURATION_MS = 200;

type HideOnScrollOptions = {
  /** Cuánto se desplaza hacia arriba al esconderse; normalmente su altura. */
  distance: number;
  /** Px de scroll a partir de los cuales se esconde. */
  thresholdPx?: number;
  durationMs?: number;
};

/**
 * Esconde un elemento al scrollear hacia abajo y lo devuelve al volver arriba.
 *
 * Anima solo `translateY`, nunca la altura: cambiar el layout obliga a Yoga a
 * recalcular el árbol en cada frame, y aquí debajo cuelga un formulario largo.
 * Por eso el elemento debe ir **superpuesto** (absolute) y su hueco reservado
 * con un espaciador estático — si estuviera en el flujo, esconderlo con
 * transform dejaría un agujero.
 *
 * El contenedor que recibe este estilo debe llevar `overflow-hidden`: como el
 * transform no altera el layout, el contenedor conserva su altura y recorta lo
 * que se sale, que es lo que hace que el elemento parezca meterse bajo lo que
 * tenga encima en vez de pasarle por delante.
 */
export function useHideOnScroll({
  distance,
  thresholdPx = DEFAULT_THRESHOLD_PX,
  durationMs = DEFAULT_DURATION_MS,
}: HideOnScrollOptions) {
  const hidden = useSharedValue(0);
  // El destino vigente, aparte de `hidden`: a mitad de animación `hidden` vale
  // un intermedio, así que no sirve para saber hacia dónde se iba.
  const target = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const next = event.contentOffset.y > thresholdPx ? 1 : 0;
      // Sin este guard se lanzaría un `withTiming` nuevo en cada evento de
      // scroll —unos 60 por segundo— reiniciando la misma animación hacia el
      // mismo sitio. Solo interesa la transición.
      if (next === target.value) return;
      target.value = next;
      hidden.value = withTiming(next, { duration: durationMs });
    },
  });

  // Solo desplazamiento, sin desvanecer: el elemento debe parecer que se mete
  // bajo lo que tenga encima, y un fade delataría que en realidad se está
  // ocultando en su sitio.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -hidden.value * distance }],
  }));

  return { scrollHandler, animatedStyle };
}
