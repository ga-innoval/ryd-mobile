import { useCallback, useRef, useState, type ComponentProps } from "react";
import { Keyboard, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedRef,
  useScrollOffset,
} from "react-native-reanimated";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import {
  CollapsibleBody,
  CollapsibleHeader,
} from "@/components/collapsible-section";
import { EvalQuestionsHeader } from "./eval-questions-form";
import { EvaluationErrorButton } from "./evaluation-error-button";
import {
  SECTIONS,
  STICKY_HEADER_INDICES,
  sectionBody,
  sectionSummary,
} from "./evaluation-section-catalog";
import { EVALUATION_SECTION_IDS } from "../lib/evaluation-schema";

/**
 * El hueco mientras la evaluación se monta.
 *
 * No tapa una espera de red: abrir un tratamiento cuesta unos 400 ms, de los
 * que **SQLite son 45–70 y el resto es pintar** las siete secciones —unos 160
 * elementos, porque nacen abiertas—. Durante ese render el hilo de JS está
 * bloqueado y no puede pintar nada nuevo, así que lo que se ve es lo último
 * que se comprometió: por eso esto se queda en pantalla los 400 ms enteros y
 * no parpadea.
 *
 * Imita solo las **cabeceras cerradas**, no los cuerpos. Es lo que de verdad
 * aparece después —las cabeceras están siempre; lo que varía es lo de dentro—,
 * y siete plantillas fieles a siete cuerpos distintos serían una copia que se
 * desincroniza al primer cambio de layout.
 *
 * Vive aquí y no en la pantalla para que quien toque la forma de
 * `CollapsibleHeader` lo tenga a la vista. Y cuenta con `SECTIONS.length`: una
 * sección nueva entra sola.
 */
export function EvaluationSectionsSkeleton({
  reservedHeight,
}: {
  reservedHeight: number;
}) {
  const pulseStyle = usePulseAnimation({ minOpacity: 0.3 });

  return (
    <View className="flex-1 px-4">
      {/* El mismo espaciador que el scroll de verdad, o el primer hueco
          quedaría bajo el bloque superpuesto de la cabecera. */}
      <View style={{ height: reservedHeight }} />

      {/* Un solo `Animated.View` para todas: un pulso por fila serían siete
          animaciones corriendo para decir lo mismo. */}
      <Animated.View style={pulseStyle}>
        {SECTIONS.map((section, index) => (
          <View key={section.id} className="bg-background pt-4">
            <View className="border-2 border-border bg-card rounded-xl">
              <View className="bg-secondary rounded-[10px]">
                <View className="flex-row items-center justify-between gap-2 px-4 py-3">
                  <View className="gap-1">
                    <View className="flex-row gap-2 items-center">
                      <View className="size-4 rounded bg-primary/20" />
                      {/* Anchos distintos por fila: siete barras idénticas se
                          leen como un patrón, no como texto cargando. */}
                      <View
                        className="h-6 rounded bg-foreground/15"
                        style={{
                          width: TITLE_WIDTHS[index % TITLE_WIDTHS.length],
                        }}
                      />
                    </View>
                    <View
                      className="h-6 rounded bg-foreground/10"
                      style={{
                        width:
                          DESCRIPTION_WIDTHS[index % DESCRIPTION_WIDTHS.length],
                      }}
                    />
                  </View>

                  <View className="size-5 rounded-full bg-foreground/10" />
                </View>

                {/* La tercera fila del resumen —«0 de 16 preguntas»—, que la
                    llevan las siete secciones. Sin ella el esqueleto medía 64
                    px contra los 112 de la cabecera real y el salto se veía. */}
                <View className="px-4 pb-3">
                  <View
                    className="h-5 rounded bg-foreground/10"
                    style={{
                      width: SUMMARY_WIDTHS[index % SUMMARY_WIDTHS.length],
                    }}
                  />
                </View>
              </View>
            </View>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * Anchos por fila, en el orden de `SECTIONS`. Aproximan el texto real —«Brix»
 * es corto, «Comentarios y observaciones» largo— para que el esqueleto no se
 * lea como un patrón. Si el catálogo crece, el `%` los reparte igual.
 */
const TITLE_WIDTHS = [96, 144, 136, 48, 64, 108, 208];
const DESCRIPTION_WIDTHS = [268, 256, 300, 212, 244, 264, 276];
const SUMMARY_WIDTHS = [132, 108, 108, 96, 120, 116, 88];

type EvaluationSectionsProps = {
  tratamientoId: string;
  /** El hueco que hay que reservar para el bloque superpuesto de la cabecera. */
  reservedHeight: number;
  /**
   * El alto de la barra de avance, que se queda fijada arriba cuando el resto
   * del bloque se esconde.
   *
   * El scroll entero empieza ahí abajo, y no es un margen decorativo: las
   * cabeceras sticky se pegan al **borde superior del scroll**, así que sin
   * esto se pegaban debajo de la barra y quedaban tapadas por ella. Con 8 px
   * apenas se notaba; en cuanto la barra creció con el porcentaje se comía la
   * cabecera de la sección entera.
   */
  pinnedHeight: number;
  /** El que esconde ese bloque al scrollear; lo crea la pantalla, que es quien
   *  lo anima. */
  onScroll: ComponentProps<typeof KeyboardAwareScrollView>["onScroll"];
};

/**
 * El scroll con las secciones de la evaluación.
 *
 * Aparte de la pantalla y montado solo cuando hay tratamiento, que es lo que
 * exige `useScrollOffset`: avisa si su `animatedRef` todavía no está puesto en
 * ningún componente, y en la pantalla el scroll aparecía un render más tarde
 * que el ref. Aquí los dos se montan juntos.
 *
 * Por eso vive aquí también todo lo que no tiene sentido sin scroll a la vista:
 * las medidas de las cabeceras y el abierto de cada sección.
 */
export function EvaluationSections({
  tratamientoId,
  reservedHeight,
  pinnedHeight,
  onScroll,
}: EvaluationSectionsProps) {
  // El `open` vive aquí y no en la sección: cabecera y cuerpo son hijos
  // sueltos del scroll —lo exige `stickyHeaderIndices`— y no hay un envoltorio
  // común donde compartirlo. Ausente es abierta.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  /**
   * Recibe el valor ya resuelto, nunca lo deduce.
   *
   * Antes invertía lo que hubiera en el mapa (`!prev[sectionId]`), y ahí había
   * una segunda opinión sobre qué significa **ausente**: para el render es
   * abierta, para aquello era cerrada. Con el mapa vacío, el primer toque hacía
   * `!undefined` —o sea `true`, «abierta»— sobre una sección que ya lo estaba,
   * así que no pasaba nada y había que tocar dos veces. A partir del segundo ya
   * alternaba bien, que es lo que lo disimulaba.
   *
   * Nació el día que las secciones pasaron a abrirse por defecto: con el
   * default anterior las dos opiniones coincidían por casualidad. Por eso no se
   * arregla poniéndolas de acuerdo —volverían a separarse al siguiente
   * cambio—, sino quitando una: quien pinta ya sabe el valor y lo pasa.
   */
  const setSectionOpen = useCallback((sectionId: string, open: boolean) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: open }));
  }, []);

  // `useScrollOffset` escucha por su propio canal de eventos, así que
  // convive con el `onScroll` de `useHideOnScroll` sin quitárselo.
  const scrollRef = useAnimatedRef<KeyboardAwareScrollViewRef>();
  const scrollOffset = useScrollOffset(scrollRef);

  // Dónde cae cada cabecera cuando no está pegada, en coordenadas del
  // contenido. En un ref y no en estado: se reescribe en cada frame del
  // pliegue de cualquier sección de más arriba, y nada de lo que se pinta
  // depende de ello.
  const sectionLayouts = useRef<
    Record<
      string,
      { bodyY?: number; headerHeight?: number; bodyHeight?: number }
    >
  >({});

  const rememberLayout = useCallback(
    (
      sectionId: string,
      patch: { bodyY?: number; headerHeight?: number; bodyHeight?: number },
    ) => {
      sectionLayouts.current[sectionId] = {
        ...sectionLayouts.current[sectionId],
        ...patch,
      };
    },
    [],
  );

  /**
   * Al plegar una sección con su cabecera pegada, lleva el scroll a la
   * posición natural de esa cabecera: no se mueve en pantalla, el cuerpo se
   * pliega bajo ella y la sección siguiente sube a su encuentro. Sin esto, el
   * offset se quedaba donde estaba y, con la sección de abajo abierta,
   * aparecías de golpe en mitad de ella.
   *
   * La posición natural es la `y` del cuerpo menos el alto de la cabecera. La
   * `y` no puede salir de la propia cabecera: siendo sticky, `ScrollView` la
   * envuelve en su propio componente y su `y` es relativa a ese envoltorio.
   *
   * El salto es instantáneo a propósito: la cabecera está pegada todo el
   * rato, así que un scroll suave haría desfilar debajo el cuerpo entero
   * mientras se pliega. Así, lo que se ve es el pliegue de siempre.
   */
  const handleToggle = useCallback(
    (sectionId: string, isOpen: boolean) => {
      const { bodyY, headerHeight } = sectionLayouts.current[sectionId] ?? {};

      // El cuerpo plegado sigue montado: un campo de Brix enfocado conservaría
      // el foco sin verse, y lo tecleado iría a parar ahí.
      if (isOpen) Keyboard.dismiss();

      if (isOpen && bodyY !== undefined && headerHeight !== undefined) {
        const headerY = bodyY - headerHeight;

        if (scrollOffset.value > headerY) {
          scrollRef.current?.scrollTo({ y: headerY, animated: false });
        }
      }

      setSectionOpen(sectionId, !isOpen);
    },
    [scrollOffset, scrollRef, setSectionOpen],
  );

  /**
   * Dónde empieza y acaba una sección en coordenadas del contenido. La cabecera
   * no puede dar su propia `y` —al ser sticky, `ScrollView` la envuelve—, así
   * que el principio se deduce restándole su alto a la `y` del cuerpo.
   */
  const sectionBounds = useCallback((sectionId: string) => {
    const { bodyY, headerHeight, bodyHeight } =
      sectionLayouts.current[sectionId] ?? {};
    if (bodyY === undefined || headerHeight === undefined) return undefined;

    return { top: bodyY - headerHeight, bottom: bodyY + (bodyHeight ?? 0) };
  }, []);

  /** Lleva la sección a lo alto de la pantalla, como al plegar una cabecera. */
  const scrollToSection = useCallback(
    (sectionId: string) => {
      const bounds = sectionBounds(sectionId);
      if (!bounds) return;

      Keyboard.dismiss();
      scrollRef.current?.scrollTo({ y: bounds.top, animated: true });
    },
    [sectionBounds, scrollRef],
  );

  // Lo que se ve del scroll, para decidir si la sección con error está fuera.
  const [viewportHeight, setViewportHeight] = useState(0);


  return (
    // El scroll y el atajo al error, superpuestos: `flex-1` para que el hueco
    // sea el de la pantalla, y el `onLayout` da el alto que hace falta para
    // saber qué secciones se están viendo.
    <View
      className="flex-1"
      // El scroll arranca bajo la barra fijada, no bajo el header: es lo que
      // hace que las cabeceras sticky se peguen por debajo de ella en vez de
      // quedarse escondidas detrás.
      style={{ paddingTop: pinnedHeight }}
      onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
    >
      {/* Brix trae campos de texto y va al final: sin esto, el teclado taparía
          las lecturas. Por dentro es un `Reanimated.ScrollView` que recibe los
          hijos tal cual —así `stickyHeaderIndices` sigue contando bien—, deja
          pasar el `onScroll` worklet y su ref es la instancia del scroll.
          `contentContainerClassName` funciona porque está registrado en
          `nativewind-interop.ts`. */}
      <KeyboardAwareScrollView
        ref={scrollRef}
        // Deja a la vista el resultado del par bajo la lectura enfocada, no
        // solo el campo.
        bottomOffset={56}
        // Con el teclado abierto, el primer toque en un botón —«Agregar
        // corte», la cabecera de un corte— solo cerraba el teclado y había
        // que tocar dos veces. Así el toque llega a quien lo maneja.
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Fija la cabecera de la sección en curso; al entrar la siguiente,
        // esta la empuja fuera. Lo hace ScrollView por su cuenta: engancha su
        // propio listener nativo, así que no se pisa con `onScroll`.
        stickyHeaderIndices={STICKY_HEADER_INDICES}
        // Sin `gap`: separaría cada cabecera de su propio cuerpo, que ahora
        // son hijos hermanos. La separación entre secciones va en el cuerpo.
        contentContainerClassName="px-4 pb-10"
      >
        {/* Reserva el hueco del bloque superpuesto. Sin holgura extra: la
              primera cabecera ya trae la suya, y sumarlas dejaría la primera
              sección al doble de distancia que las demás.

              Se le descuenta lo que ya aporta el `paddingTop` de arriba, o el
              bloque quedaría reservado dos veces. */}
        <View style={{ height: Math.max(0, reservedHeight - pinnedHeight) }} />
        {/* Un array se aplana en los hijos del scroll (un Fragment no), que
              es lo que permite generar las secciones y seguir teniendo cabecera
              y cuerpo como hijos indexables.

              Los valores de cada sección viven en el formulario, bajo su
              propio `id` (ver `evaluationSchema`). */}
        {SECTIONS.flatMap((section) => {
          const open = openSections[section.id] ?? true;

          const headerProps = {
            icon: section.icon,
            title: section.title,
            description: section.description,
            open,
            onToggle: () => handleToggle(section.id, open),
            onLayout: (event: LayoutChangeEvent) =>
              rememberLayout(section.id, {
                headerHeight: event.nativeEvent.layout.height,
              }),
          };

          return [
            section.kind === "questions" ? (
              // Su avance lo calcula ella con un `useWatch` de su sección,
              // para que contestar no re-renderice la pantalla.
              <EvalQuestionsHeader
                key={`${section.id}-header`}
                {...headerProps}
                sectionId={section.id}
                questions={section.questions}
              />
            ) : (
              // Las que no son preguntas resumen lo suyo en el mismo hueco
              // de la cabecera, y cada resumen lee sus propios valores.
              <CollapsibleHeader
                key={`${section.id}-header`}
                {...headerProps}
                summary={sectionSummary(section, tratamientoId)}
              />
            ),
            <CollapsibleBody
              key={`${section.id}-body`}
              open={open}
              onLayout={(event) =>
                rememberLayout(section.id, {
                  bodyY: event.nativeEvent.layout.y,
                  // El alto lo usa el atajo al error para saber si la sección
                  // sigue asomando por el borde de la pantalla.
                  bodyHeight: event.nativeEvent.layout.height,
                })
              }
            >
              {sectionBody(section, tratamientoId)}
            </CollapsibleBody>,
          ];
        })}
      </KeyboardAwareScrollView>

      <EvaluationErrorButton
        order={EVALUATION_SECTION_IDS}
        boundsOf={sectionBounds}
        scrollOffset={scrollOffset}
        viewportHeight={viewportHeight}
        onGoTo={scrollToSection}
      />
    </View>
  );
}
