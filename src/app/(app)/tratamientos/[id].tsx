import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  View,
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
import { EvaluationSections } from "@/domains/plants/components/evaluation-sections";
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

/** Alto de la barra de avance, en px. Hace falta como número y no como clase:
 *  es lo que se le resta al desplazamiento para que se quede pegada al header
 *  en vez de irse con el bloque. */
const PROGRESS_BAR_HEIGHT = 8;

/**
 * El avance de la evaluación, pegado al pie del bloque de la cabecera.
 *
 * Se queda a la vista cuando el bloque se esconde: sube con él pero solo lo
 * justo para quedar bajo el header, que es lo que hace el `translateY` recortado
 * que recibe. Lleva su propio fondo verde porque al quedarse arriba, lo que pasa
 * por detrás es el formulario.
 *
 * Lee el avance del store y no del formulario para no re-renderizar la pantalla
 * entera: la cabecera se pinta fuera de ella y este es el mismo camino.
 */
function EvaluationProgressBar({
  style,
}: {
  style: StyleProp<AnimatedStyle<ViewStyle>>;
}) {
  const progress = useEvaluationSaveStore((state) => state.progress);

  return (
    <Animated.View
      pointerEvents="none"
      style={[style, { position: "absolute", left: 0, right: 0, bottom: 0 }]}
    >
      <View className="bg-primary">
        <Progress
          value={progress * 100}
          className="h-2 w-auto rounded-none bg-primary-foreground/25 border-b-2 border-border"
          indicatorClassName="bg-foreground rounded-none"
        />
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
          -hidden.value * Math.max(0, reservedHeight - PROGRESS_BAR_HEIGHT),
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

            <EvaluationProgressBar style={progressBarStyle} />
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
          <>
            {/* No pinta nada: guarda y le cuenta a la cabecera cómo va. Va
              dentro del `FormProvider` porque mira el formulario entero, y con
              `key` para que al saltar a un hermano empiece de cero — lo que
              lleva guardado es de este tratamiento, no del siguiente. */}
            <EvaluationAutosave key={id} tratamientoId={id} />
            <EvaluationSections
              tratamientoId={id}
              reservedHeight={reservedHeight}
              onScroll={scrollHandler}
            />
          </>
        )}
      </View>
    </FormProvider>
  );
}
