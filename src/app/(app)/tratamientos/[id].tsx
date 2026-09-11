import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useHideOnScroll } from "@/lib/use-hide-on-scroll";
import { useTratamiento } from "@/domains/plants/hooks/use-tratamiento";
import { TratamientosPageHeader } from "@/domains/navigation/tratamientos-page-header";
import {
  TratamientoChip,
  TratamientoChipSkeleton,
} from "@/domains/plants/components/tratamiento-chip";
import { EmptyState } from "@/components/empty-state";
import {
  CollapsibleBody,
  CollapsibleHeader,
} from "@/components/collapsible-section";
import { EvalQuestionsForm } from "@/domains/plants/components/eval-questions-form";
import { calcEvalProgress } from "@/domains/plants/lib/calc-eval-progress";
import { EVALS_EXTERIOR } from "@/domains/plants/lib/evals-exterior";
import { EVALS_INTERIOR } from "@/domains/plants/lib/evals-interior";
import { GhostIcon, GrapeIcon, MicroscopeIcon } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import type { EvalAnswers, PlantRecord } from "@/domains/plants/types";
import { cn } from "@/lib/utils";

const PLANT_FIELDS = [
  { label: "Campo", key: "campo", valueCn: "capitalize" },
  { label: "Cuadro", key: "cuadro", valueCn: "uppercase" },
  { label: "Programa", key: "programa", valueCn: "uppercase" },
  { label: "Patrón", key: "portainjerto", valueCn: "capitalize" },
  { label: "Año", key: "anio", valueCn: "" },
] as const;

/**
 * Los mismos datos que la tarjeta del listado, con su misma normalización: el
 * valor se pasa a minúsculas y es `valueCn` quien decide cómo se presenta. Sin
 * eso, un `campo` guardado como "SAN JOSE" saldría distinto aquí que en la
 * lista.
 */
function PlantFields({ plant }: { plant: PlantRecord }) {
  return (
    <View className="flex-row flex-wrap gap-4">
      {PLANT_FIELDS.map(({ label, key, valueCn }) => (
        <View key={key} className="flex-row items-center gap-2">
          <Text variant="muted" className="text-primary-foreground/60">
            {label}
          </Text>
          <Text
            className={cn("font-semibold text-primary-foreground", valueCn)}
          >
            {String(plant[key]).toLocaleLowerCase()}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Un hueco por campo real, para que el bloque no cambie de alto al llegar
 *  el dato y arrastre consigo el espaciador que reserva su sitio. */
function PlantFieldsSkeleton() {
  const pulseStyle = usePulseAnimation({ minOpacity: 0.3 });

  return (
    <Animated.View style={pulseStyle}>
      <View className="flex-row flex-wrap gap-4">
        {PLANT_FIELDS.map(({ key }) => (
          <View
            key={key}
            className="h-5 w-28 rounded bg-primary-foreground/20"
          />
        ))}
      </View>
    </Animated.View>
  );
}

const SECTIONS = [
  {
    id: "exterior",
    icon: GrapeIcon,
    title: "Evaluación Exterior",
    description: "Forma, color, firmeza y arreglo del racimo y de la baya.",
    questions: EVALS_EXTERIOR,
  },
  {
    id: "interior",
    icon: MicroscopeIcon,
    title: "Evaluación Interior",
    description:
      "Características de la pulpa, la piel, el sabor y la experiencia de consumo.",
    questions: EVALS_INTERIOR,
  },
];

/**
 * Qué hijos del scroll se quedan fijos al llegar arriba. Van derivados y no a
 * mano porque `stickyHeaderIndices` indexa los hijos directos del contenedor:
 * el espaciador ocupa el 0 y cada sección aporta cabecera y cuerpo, así que
 * añadir una sección con índices escritos a mano descuadraría el pegado sin
 * dar ningún error.
 */
const STICKY_HEADER_INDICES = SECTIONS.map((_, index) => 1 + index * 2);

export default function TratamientoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useTratamiento(id);
  const router = useRouter();

  // Estado local por ahora: la captura no se persiste hasta que exista la
  // tabla `respuestas`.
  const [answers, setAnswers] = useState<EvalAnswers>({});

  // El `open` vive aquí y no en la sección: cabecera y cuerpo son hijos
  // sueltos del scroll —lo exige `stickyHeaderIndices`— y ya no hay un
  // envoltorio común donde compartirlo. Ausente es cerrada.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // `setParams` cambia de hermano sin desmontar la pantalla, así que sin esto
  // las respuestas del tratamiento anterior seguirían aquí.
  useEffect(() => {
    setAnswers({});
  }, [id]);

  // El bloque va superpuesto, así que su hueco se reserva con un espaciador y
  // hay que medirlo. Si no se renderiza, no hay hueco que reservar.
  const showHeaderExtras = isLoading || !!data;
  const [headerExtrasHeight, setHeaderExtrasHeight] = useState(0);
  const reservedHeight = showHeaderExtras ? headerExtrasHeight : 0;

  // Los campos de la plantación se muestran siempre; los hermanos solo si hay
  // más de uno, o la barra sería un chip que apunta a sí mismo. Mientras carga
  // sí se muestran: el caso común tiene varios, y esconderlos por defecto haría
  // que aparecieran de golpe en cuanto llega el dato.
  const showSiblings =
    isLoading || (data ? data.tratamientos.length > 1 : false);

  const { scrollHandler, animatedStyle } = useHideOnScroll({
    distance: reservedHeight,
  });

  const handleAnswerChange = useCallback(
    (questionId: string, value: string | undefined) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
    },
    [],
  );

  // Sin memo, cada respuesta capturada re-renderiza la pantalla, reconstruye
  // este objeto y empuja opciones nuevas al navigator. Depende solo de los dos
  // nombres, no del objeto `data` entero, para que un refetch que devuelva lo
  // mismo no cuente como cambio.
  const plantName = data?.plant.name;
  const tratamientoName = data?.tratamiento.name;
  const screenOptions = useMemo(
    () => ({
      title: tratamientoName ?? "Tratamiento",
      header: () => (
        <TratamientosPageHeader
          plantName={plantName}
          tratamientoName={tratamientoName}
          isLoading={isLoading}
        />
      ),
    }),
    [plantName, tratamientoName, isLoading],
  );

  return (
    <View className="flex-1 bg-background">
      {/* Se registra fuera de cualquier rama para que el header exista desde
          el primer frame: su estructura ya es visible mientras carga y solo
          los nombres son skeleton, así no hay salto de layout al llegar el
          dato ni una pantalla sin cabecera. */}
      <Stack.Screen options={screenOptions} />

      {/* Datos de la plantación y acceso rápido a sus demás tratamientos.
          Comparte `bg-primary` con el header para leerse como parte de él,
          igual que la barra de búsqueda en `index.tsx`. No caben en el header
          —de ahí que cuelguen de él— y se esconden juntos al scrollear. */}
      {showHeaderExtras && (
        // El posicionamiento va en un `View` normal y la animación en el
        // `Animated.View` de dentro: no se superponen NativeWind y Reanimated
        // sobre el mismo elemento.
        // `overflow-hidden` es lo que hace que parezca meterse bajo el
        // header: el transform no cambia el layout, así que este contenedor
        // conserva la altura del bloque y recorta lo que se desplaza fuera.
        <View className="absolute top-0 left-0 right-0 z-10 overflow-hidden">
          <Animated.View style={animatedStyle}>
            {/* Un solo `onLayout` para el bloque entero: campos y hermanos se
                esconden como una pieza, así que lo que hay que medir —y lo que
                el espaciador reserva— es el conjunto. */}
            <View
              className="bg-primary gap-3 px-4 pb-3 pt-1"
              onLayout={(e) =>
                setHeaderExtrasHeight(e.nativeEvent.layout.height)
              }
            >
              {isLoading ? (
                <PlantFieldsSkeleton />
              ) : (
                data && <PlantFields plant={data.plant} />
              )}

              {/* Los márgenes negativos dejan que el scroll llegue a los bordes
                  sin perder el padding del contenido. */}
              {showSiblings && (
                <ScrollView
                  className="-mx-4"
                  contentContainerClassName="flex-row items-center gap-4 px-4 mt-2"
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {isLoading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <TratamientoChipSkeleton key={i} />
                      ))
                    : data?.tratamientos.map((trat) => (
                        // El resaltado se compara contra el `id` de la ruta y
                        // no contra el dato cargado: `setParams` lo actualiza
                        // al instante, así que el chip se invierte en el mismo
                        // frame del toque y el contenido llega detrás.
                        <TratamientoChip
                          key={trat.id}
                          tratamiento={trat}
                          variant="header"
                          isActive={trat.id === id}
                          // Mismo screen, otro parámetro: `setParams` cambia
                          // los params sin navegar, así que no hay transición
                          // ni remonte. `replace` sí navegaba, y de ahí la
                          // animación que sobraba.
                          onPress={() => router.setParams({ id: trat.id })}
                        />
                      ))}
                </ScrollView>
              )}
            </View>
          </Animated.View>
        </View>
      )}

      {/* Alcanzable de verdad, no defensivo: una descarga puede podar el
          tratamiento mientras esta pantalla está abierta. No se navega hacia
          atrás solo, que resulta brusco si el usuario está leyendo. */}
      {!isLoading && !data && (
        <EmptyState
          icon={GhostIcon}
          title="Tratamiento no disponible"
          body="Puede que se haya eliminado en la última descarga."
        />
      )}

      {data && (
        <Animated.ScrollView
          onScroll={scrollHandler}
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
              sección al doble de distancia que las demás. */}
          <View style={{ height: reservedHeight }} />
          {/* Un array se aplana en los hijos del scroll (un Fragment no), que
              es lo que permite generar las secciones y seguir teniendo cabecera
              y cuerpo como hijos indexables.

              Las respuestas de todas las secciones viven en el mismo `answers`:
              los ids de pregunta son únicos entre catálogos, no solo dentro de
              cada uno. */}
          {SECTIONS.flatMap((section) => {
            const open = openSections[section.id] ?? false;

            return [
              <CollapsibleHeader
                key={`${section.id}-header`}
                icon={section.icon}
                title={section.title}
                description={section.description}
                open={open}
                onToggle={() => toggleSection(section.id)}
                // TODO(respuestas): sale del estado de la pantalla, así que se
                // pierde al salir. Cuando exista la tabla cambia el origen del
                // dato, no el cálculo.
                progress={calcEvalProgress(section.questions, answers)}
              />,
              <CollapsibleBody key={`${section.id}-body`} open={open}>
                <EvalQuestionsForm
                  questions={section.questions}
                  answers={answers}
                  onAnswerChange={handleAnswerChange}
                />
              </CollapsibleBody>,
            ];
          })}
        </Animated.ScrollView>
      )}
    </View>
  );
}
