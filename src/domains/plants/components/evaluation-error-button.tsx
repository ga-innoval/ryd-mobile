import { useEffect, useState } from "react";
import { Pressable } from "react-native";
import { useWatch } from "react-hook-form";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { useAppearAnimation } from "@/lib/use-appear-animation";
import { Text } from "@/components/ui/text";
import { evaluationErrors } from "../lib/evaluation-errors";
import type {
  EvaluationFormValues,
  EvaluationSectionId,
} from "../lib/evaluation-schema";

/**
 * Cuánto tiene que asomar la sección para darla por vista. Sin este margen, el
 * botón parpadearía con la sección justo en el borde.
 */
const EDGE = 24;

/**
 * El rebote que no para: es lo que mantiene el botón a la vista del evaluador
 * mientras el error siga ahí, sin robarle la atención mientras captura.
 *
 * Un salto corto y una pausa larga —el ciclo dura casi dos segundos— es lo que
 * lo hace discreto. Sin la pausa sería un temblor permanente, y eso cansa en
 * media hora de captura. La bajada lleva `Easing.bounce` porque es la que se
 * lee como rebote de verdad.
 */
const BOB_PX = 8;
const BOB_UP_MS = 240;
const BOB_DOWN_MS = 320;
const BOB_REST_MS = 1_200;

/** Dónde queda la sección respecto a lo que se ve. */
const enum Where {
  Visible = 0,
  Below = 1,
  Above = -1,
}

/** Dónde empieza y acaba una sección en coordenadas del contenido. */
export type SectionBounds = { top: number; bottom: number };

type EvaluationErrorButtonProps = {
  /**
   * Las secciones en el orden de la pantalla, para señalar la primera con
   * error y no una cualquiera.
   */
  order: EvaluationSectionId[];
  /** Dónde cae cada sección; `undefined` mientras no se haya medido. */
  boundsOf: (seccion: EvaluationSectionId) => SectionBounds | undefined;
  scrollOffset: SharedValue<number>;
  /** Alto del scroll, para saber qué entra en pantalla. */
  viewportHeight: number;
  onGoTo: (seccion: EvaluationSectionId) => void;
};

/**
 * El atajo al error de captura: aparece cuando la sección que lo tiene se ha
 * quedado fuera de lo que se ve, y desaparece en cuanto vuelve a entrar.
 *
 * Está aquí y no en la cabecera a propósito. Allí el aviso de error competía con
 * el estado de guardado y acababa tapando el "Guardando…" justo cuando había
 * algo sin escribir — que es cuando más falta hace verlo. Son dos cosas
 * distintas: la cabecera dice si el trabajo está a salvo, y esto dice si hay
 * algo que revisar y por dónde cae.
 *
 * Mira el formulario por su cuenta con `useWatch` para que teclear no
 * re-renderice el scroll entero, igual que hacen los resúmenes de cabecera.
 */
export function EvaluationErrorButton({
  order,
  boundsOf,
  scrollOffset,
  viewportHeight,
  onGoTo,
}: EvaluationErrorButtonProps) {
  const values = useWatch<EvaluationFormValues>() as EvaluationFormValues;
  const errors = evaluationErrors(values);
  const target = order.find((seccion) => errors.includes(seccion));

  // La posición de la sección vive en un ref del scroll —se reescribe en cada
  // pliegue—, así que para compararla contra el scroll en el hilo de la
  // interfaz hay que copiarla a valores compartidos. La copia va en un efecto y
  // no en el render: escribir en `.value` mientras se pinta es lo que dispara el
  // "Writing to `value` during component render" de Reanimated.
  const top = useSharedValue(0);
  const bottom = useSharedValue(0);
  const measured = useSharedValue(false);

  const bounds = target ? boundsOf(target) : undefined;

  useEffect(() => {
    top.value = bounds?.top ?? 0;
    bottom.value = bounds?.bottom ?? 0;
    measured.value = bounds !== undefined;
  }, [bounds, top, bottom, measured]);

  const [where, setWhere] = useState<Where>(Where.Visible);

  const bob = useSharedValue(0);

  useAnimatedReaction(
    () => {
      if (!measured.value || viewportHeight === 0) return Where.Visible;

      const start = scrollOffset.value;
      const end = start + viewportHeight;

      if (bottom.value < start + EDGE) return Where.Above;
      if (top.value > end - EDGE) return Where.Below;

      return Where.Visible;
    },
    // Solo cruza al hilo de JS cuando el resultado cambia, no en cada frame de
    // scroll.
    (next, previous) => {
      if (next !== previous) runOnJS(setWhere)(next);
    },
  );

  // Montado mientras haya error, aunque no se vea: hace falta para que entre y
  // salga animado en vez de aparecer de golpe.
  const shown = target !== undefined && where !== Where.Visible;

  // La misma entrada que el botón de volver arriba del listado.
  const { style: appearStyle } = useAppearAnimation(shown);

  useEffect(() => {
    if (!shown) {
      // Escondido no se anima: un bucle infinito en el hilo de la interfaz
      // gastando por algo que nadie ve.
      cancelAnimation(bob);
      bob.value = 0;
      return;
    }

    bob.value = withRepeat(
      withSequence(
        withTiming(-BOB_PX, {
          duration: BOB_UP_MS,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0, { duration: BOB_DOWN_MS, easing: Easing.bounce }),
        withDelay(BOB_REST_MS, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );

    return () => cancelAnimation(bob);
  }, [shown, bob]);

  // El rebote va en su propia capa y no sumado a la entrada: dos `transform` en
  // el mismo estilo se pisan, y separarlos deja que cada animación conserve su
  // curva.
  const bobStyle = useAnimatedStyle(() => ({
    alignItems: "flex-end",
    transform: [{ translateY: bob.value }],
  }));

  if (!target) return null;

  return (
    // Posición en `style` y aspecto en `className`, sin mezclarlos en el mismo
    // componente: Reanimated y NativeWind se disputarían la prop `style`.
    //
    // `box-none`: la barra ocupa el ancho del scroll, y los toques que no caigan
    // en la píldora tienen que seguir llegando al formulario de debajo.
    <Animated.View
      pointerEvents="box-none"
      style={[
        appearStyle,
        { position: "absolute", left: 0, right: 24, bottom: 24 },
      ]}
    >
      <Animated.View pointerEvents="box-none" style={bobStyle}>
        <Pressable
          // Escondido no se toca: el estilo lo deja invisible, pero seguiría
          // tragándose los toques encima de la última sección.
          pointerEvents={shown ? "auto" : "none"}
          onPress={() => onGoTo(target)}
          role="button"
          aria-label="Ir al error de captura"
          className="h-12 flex-row items-center gap-2.5 rounded-full bg-destructive px-5 shadow-lg shadow-black/25 active:scale-95"
        >
          <Text className="font-semibold text-white">Error de captura</Text>
          <Icon
            as={where === Where.Below ? ArrowDownIcon : ArrowUpIcon}
            size={18}
            className="text-white"
            strokeWidth={2.4}
          />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
