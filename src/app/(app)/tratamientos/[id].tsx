import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Animated, {
  useAnimatedStyle,
  type AnimatedStyle,
} from "react-native-reanimated";
import { useAppRouter } from "@/lib/use-app-router";
import { useHideOnScroll } from "@/lib/use-hide-on-scroll";
import { useTratamiento } from "@/domains/plants/hooks/use-tratamiento";
import { useRespuestas } from "@/domains/plants/hooks/use-respuestas";
import { buildEvaluationFromRespuestas } from "@/domains/plants/lib/build-evaluation-from-respuestas";
import { EvaluationAutosave } from "@/domains/plants/components/evaluation-autosave";
import {
  EvaluationSections,
  EvaluationSectionsSkeleton,
} from "@/domains/plants/components/evaluation-sections";
import { TratamientosPageHeader } from "@/domains/navigation/tratamientos-page-header";
import {
  TratamientoChip,
  TratamientoChipSkeleton,
} from "@/domains/plants/components/tratamiento-chip";
import { EmptyState } from "@/components/empty-state";
import {
  buildEvaluationDefaults,
  evaluationSchema,
  type EvaluationFormValues,
  type EvaluationValues,
} from "@/domains/plants/lib/evaluation-schema";
import { GhostIcon } from "lucide-react-native";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { useEvaluationSaveStore } from "@/domains/plants/store/evaluation-save-store";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import type { PlantRecord } from "@/domains/plants/types";
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
function EvaluationProgressBar({
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
        {/* <Text className="text-[13px] font-bold tracking-wider text-primary-foreground/70">
          PROGRESO
        </Text> */}
        <Progress
          value={progress * 100}
          className="h-2 flex-1 rounded-full bg-primary-foreground/25"
          // El verde de siempre, no el del diseño: el artboard pinta la barra y
          // el punto de "Guardado" del mismo `green-300`, y en la app ese punto
          // es `leaf`. Seguir el artboard aquí habría metido un tercer verde.
          indicatorClassName="bg-foreground rounded-full"
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

export default function TratamientoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useTratamiento(id);
  const { data: respuestas } = useRespuestas(id);
  const router = useAppRouter();

  // La evaluación entera. Es el búfer de edición: cuando exista la tabla
  // `respuestas`, lo guardado serán sus `defaultValues`, guardar será
  // `handleSubmit`, y "hay cambios sin guardar", `isDirty`.
  const form = useForm<EvaluationFormValues, unknown, EvaluationValues>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: buildEvaluationDefaults(),
    // Los errores aparecen al intentar guardar y se corrigen en vivo después;
    // mientras se captura, nada regaña. Los avisos de rango de Brix no pasan
    // por aquí: van por su propio esquema.
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { reset } = form;

  // `setParams` cambia de hermano sin desmontar la pantalla, así que sin esto
  // las respuestas del tratamiento anterior seguirían aquí.
  //
  // Compara contra el id anterior en vez de limpiar en cada efecto: tal cual
  // estaba, cualquier remonte borraba lo ya contestado. Las fotografías no
  // necesitan nada de esto: se consultan por tratamiento, así que cambiar de
  // hermano ya trae las suyas.
  const previousId = useRef(id);
  // Lo guardado ya se volcó para este tratamiento. Es lo que impide que un
  // refetch posterior pise lo que el evaluador está escribiendo: el volcado
  // ocurre una sola vez por tratamiento, no cada vez que la consulta responde.
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (previousId.current !== id) {
      previousId.current = id;
      loadedFor.current = null;
      // Se vacía ya, sin esperar a SQLite: si no, durante la consulta seguirían
      // a la vista las respuestas del tratamiento anterior.
      reset(buildEvaluationDefaults());
    }

    if (respuestas && loadedFor.current !== id) {
      loadedFor.current = id;
      reset(buildEvaluationFromRespuestas(respuestas));
    }
  }, [id, respuestas, reset]);

  // El bloque va superpuesto, así que su hueco se reserva con un espaciador y
  // hay que medirlo. Si no se renderiza, no hay hueco que reservar.
  const showHeaderExtras = isLoading || !!data;
  const [headerExtrasHeight, setHeaderExtrasHeight] = useState(0);
  const reservedHeight = showHeaderExtras ? headerExtrasHeight : 0;

  // La barra va superpuesta al pie del bloque para poder quedarse pegada
  // mientras el resto se esconde, así que el bloque tiene que reservarle su
  // hueco: sin esto le taparía los chips de tratamiento.
  const [progressBarHeight, setProgressBarHeight] = useState(0);

  // Los campos de la plantación se muestran siempre; los hermanos solo si hay
  // más de uno, o la barra sería un chip que apunta a sí mismo. Mientras carga
  // sí se muestran: el caso común tiene varios, y esconderlos por defecto haría
  // que aparecieran de golpe en cuanto llega el dato.
  const showSiblings =
    isLoading || (data ? data.tratamientos.length > 1 : false);

  const { scrollHandler, animatedStyle, hidden } = useHideOnScroll({
    distance: reservedHeight,
  });

  // La barra acompaña al bloque pero se detiene bajo el header: sube su alto
  // menos el suyo propio, así que acaba justo donde el bloque desaparece.
  const progressBarStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          -hidden.value * Math.max(0, reservedHeight - progressBarHeight),
      },
    ],
  }));

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
    // Solo alcanza al árbol de esta pantalla: el header del navigator
    // (`options.header`) se pinta fuera de él y no verá este contexto.
    <FormProvider {...form}>
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
          //
          // Y por eso mismo tiene que dejar pasar los toques (`box-none`): con
          // el bloque escondido, este contenedor sigue ahí, invisible y en
          // `z-10`, justo donde se pega la cabecera sticky de la sección. Sin
          // esto se tragaba sus toques y no había forma de plegarla desde
          // abajo. Sus hijos —los chips— siguen recibiéndolos con el bloque a
          // la vista.
          //
          // Prop y no clase: `react-native-css-interop` no conoce `box-none`,
          // y una clase inexistente fallaría en silencio.
          <View
            pointerEvents="box-none"
            className="absolute top-0 left-0 right-0 z-10 overflow-hidden"
          >
            <Animated.View style={animatedStyle}>
              {/* Un solo `onLayout` para el bloque entero: campos y hermanos se
                esconden como una pieza, así que lo que hay que medir —y lo que
                el espaciador reserva— es el conjunto. */}
              <View
                className="bg-primary gap-3 px-4 pt-1"
                // El hueco de la barra superpuesta, en vez de un `pb-*` fijo.
                style={{ paddingBottom: progressBarHeight }}
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
                    contentContainerClassName="flex-row items-center gap-4 px-4 pb-2"
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

            <EvaluationProgressBar
              style={progressBarStyle}
              onLayout={(e) =>
                setProgressBarHeight(e.nativeEvent.layout.height)
              }
            />
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

        {/* Las secciones tardan ~400 ms en montarse, casi todo en pintarlas,
          así que sin esto el formulario es un hueco en blanco durante ese
          rato. Va atado a `isLoading` y no a `!data`: con el tratamiento
          podado lo que toca es el `EmptyState` de arriba, no un esqueleto
          esperando algo que no va a llegar. */}
        {isLoading && (
          <EvaluationSectionsSkeleton reservedHeight={reservedHeight} />
        )}

        {data && (
          <>
            {/* No pinta nada: guarda y le cuenta a la cabecera cómo va. Va
              dentro del `FormProvider` porque mira el formulario entero, y con
              `key` para que al saltar a un hermano empiece de cero — lo que
              lleva guardado es de este tratamiento, no del siguiente. */}
            <EvaluationAutosave key={id} tratamientoId={id} />
            <EvaluationSections
              tratamientoId={id}
              reservedHeight={reservedHeight}
              pinnedHeight={progressBarHeight}
              onScroll={scrollHandler}
            />
          </>
        )}
      </View>
    </FormProvider>
  );
}
