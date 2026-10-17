import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState, type ComponentProps } from "react";
import { ScrollView, View } from "react-native";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useAppRouter } from "@/lib/use-app-router";
import { useHideOnScroll } from "@/lib/use-hide-on-scroll";
import { useTratamiento } from "@/domains/plants/hooks/use-tratamiento";
import { useRespuestas } from "@/domains/plants/hooks/use-respuestas";
import { useFotos } from "@/domains/plants/hooks/use-respuesta-fotos";
import { buildEvaluationFromRespuestas } from "@/domains/plants/lib/build-evaluation-from-respuestas";
import type { RespuestaRecord } from "@/domains/plants/types";
import { EvaluationAutosave } from "@/domains/plants/components/evaluation-autosave";
import { EvaluationProgressBar } from "@/domains/plants/components/evaluation-progress-bar";
import {
  PlantFields,
  PlantFieldsSkeleton,
} from "@/domains/plants/components/plant-fields";
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
  evaluationSchema,
  type EvaluationFormValues,
  type EvaluationValues,
} from "@/domains/plants/lib/evaluation-schema";
import { GhostIcon } from "lucide-react-native";

export default function TratamientoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useTratamiento(id);
  const { data: respuestas } = useRespuestas(id);
  const { data: fotos } = useFotos(id);
  const router = useAppRouter();

  // **Lo capturado se espera aquí, antes de montar nada.** Las respuestas y las
  // fotografías son consultas aparte de la plantación, y con `gcTime: 0` las
  // respuestas se piden de nuevo en cada visita. Montar las secciones con solo la
  // plantación las pintaba vacías un instante, con «0 de 3 categorías» y sin una
  // sola respuesta, y luego se rellenaban. Hasta que llegan las dos, esqueleto.
  const ready = !!data && !!respuestas && !!fotos;

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
          tratamientoId={id}
          plantName={plantName}
          tratamientoName={tratamientoName}
          isLoading={isLoading}
        />
      ),
    }),
    [id, plantName, tratamientoName, isLoading],
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
          rato. Dura hasta que llega **todo**: la plantación, las respuestas y
          las fotografías. Y no se ata a `!data` sino a `data && !ready`: con el
          tratamiento podado lo que toca es el `EmptyState` de arriba, no un
          esqueleto esperando algo que no va a llegar. */}
        {(isLoading || (data && !ready)) && (
          <EvaluationSectionsSkeleton reservedHeight={reservedHeight} />
        )}

        {/* La `key` es lo que vacía el formulario al saltar a un hermano: cada
          tratamiento tiene el suyo, nacido ya con sus respuestas. */}
        {ready && (
          <TratamientoForm
            key={id}
            tratamientoId={id}
            respuestas={respuestas}
            reservedHeight={reservedHeight}
            pinnedHeight={progressBarHeight}
            onScroll={scrollHandler}
          />
        )}
    </View>
  );
}

type TratamientoFormProps = {
  tratamientoId: string;
  respuestas: RespuestaRecord[];
  reservedHeight: number;
  pinnedHeight: number;
  onScroll: ComponentProps<typeof EvaluationSections>["onScroll"];
};

/**
 * El formulario de un tratamiento y lo que cuelga de él.
 *
 * **Nace con las respuestas ya puestas** (`defaultValues`) y se monta solo cuando
 * ya están: por eso desaparecieron el `reset` en un efecto y el `loadedFor` que
 * impedían que un refetch pisara lo tecleado. Un formulario que solo lee sus
 * valores iniciales al nacer no tiene ese problema, y tampoco el cuadro en blanco
 * entre pintar y volcar.
 *
 * El precio es que **cada tratamiento remonta las secciones** (~400 ms), con su
 * esqueleto: saltar de chip ya no es un `reset` en el sitio. Y el plegado de las
 * secciones se pierde al saltar, porque vive dentro de ellas.
 */
function TratamientoForm({
  tratamientoId,
  respuestas,
  reservedHeight,
  pinnedHeight,
  onScroll,
}: TratamientoFormProps) {
  // Se calcula una sola vez: `useForm` solo lee los iniciales al nacer, y esto
  // recorre las seis secciones.
  const [defaultValues] = useState(() =>
    buildEvaluationFromRespuestas(respuestas),
  );

  // La evaluación entera. Es el búfer de edición; guardar lo hace el
  // autoguardado, no `handleSubmit`.
  const form = useForm<EvaluationFormValues, unknown, EvaluationValues>({
    resolver: zodResolver(evaluationSchema),
    defaultValues,
    // Los errores aparecen al intentar guardar y se corrigen en vivo después;
    // mientras se captura, nada regaña. Los avisos de rango de Brix no pasan
    // por aquí: van por su propio esquema.
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  return (
    // Solo alcanza a este árbol: el header del navigator (`options.header`) se
    // pinta fuera de él y no verá este contexto.
    <FormProvider {...form}>
      {/* No pinta nada: guarda y le cuenta a la cabecera cómo va. Va dentro del
        `FormProvider` porque mira el formulario entero. */}
      <EvaluationAutosave tratamientoId={tratamientoId} />
      <EvaluationSections
        tratamientoId={tratamientoId}
        reservedHeight={reservedHeight}
        pinnedHeight={pinnedHeight}
        onScroll={onScroll}
      />
    </FormProvider>
  );
}
