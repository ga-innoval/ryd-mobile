import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState, type ComponentProps } from "react";
import { ScrollView, View } from "react-native";
import { FormProvider, useForm } from "react-hook-form";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CameraIcon, GhostIcon } from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useAppRouter } from "@/lib/use-app-router";
import { useHideOnScroll } from "@/lib/use-hide-on-scroll";
import { usePlant } from "@/domains/plants/hooks/use-plant";
import { PostcosechaPageHeader } from "@/domains/navigation/postcosecha-page-header";
import {
  PlantFields,
  PlantFieldsSkeleton,
} from "@/domains/plants/components/plant-fields";
import { PostcosechaChip } from "@/domains/plants/components/postcosecha-chip";
import { EmptyState } from "@/components/empty-state";
import {
  CollapsibleBody,
  CollapsibleHeader,
} from "@/components/collapsible-section";
import {
  PostcosechaPhotosForm,
  PostcosechaPhotosHeaderSummary,
} from "@/domains/plants/components/postcosecha-photos";
import { PostcosechaFrutaSection } from "@/domains/plants/components/postcosecha-fruta";
import { PostcosechaComentariosSection } from "@/domains/plants/components/postcosecha-comentarios";
import { PostcosechaAutosave } from "@/domains/plants/components/postcosecha-autosave";
import { EvaluationProgressBar } from "@/domains/plants/components/evaluation-progress-bar";
import { usePostcosechaRespuestas } from "@/domains/plants/hooks/use-postcosecha-respuestas";
import { usePostcosechaFotos } from "@/domains/plants/hooks/use-postcosecha-fotos";
import type { PostcosechaRespuestaRecord } from "@/domains/plants/lib/db/postcosecha-respuestas.repository";
import { buildPostcosechaFromRespuestas } from "@/domains/plants/lib/build-postcosecha-from-respuestas";
import { type PostcosechaFormValues } from "@/domains/plants/lib/postcosecha-schema";
import { EVALS_POST_COSECHA } from "@/domains/plants/lib/evals-post-cosecha";
import {
  SectionSkeleton,
  type SectionSkeletonRow,
} from "@/domains/plants/components/section-skeleton";

/**
 * Los anchos de las tres cabeceras mientras la pantalla se monta, aproximando
 * su texto real: «Fotografías» es corto y «Comentarios y observaciones» largo.
 * Si se añade una sección, su fila entra aquí.
 */
const SKELETON_ROWS: SectionSkeletonRow[] = [
  { title: 96, description: 180, summary: 148 },
  { title: 136, description: 300, summary: 120 },
  { title: 208, description: 276, summary: 88 },
];

/**
 * Una evaluación de post-cosecha.
 *
 * **La ruta identifica la plantación, no la evaluación**, y cuál de las cuatro
 * va en `eval`. Post-cosecha no tiene entidad propia en SQLite: sus variantes
 * salen de `EVALS_POST_COSECHA`, catálogo fijo del negocio. La plantación sí es
 * real, así que es la que da el `[id]`.
 *
 * Efecto útil: saltar de variante es `setParams({ eval })`, que cambia el
 * parámetro **sin navegar**, así que no hay transición ni remonte — el mismo
 * camino que usan los chips de tratamiento.
 */
export default function PostcosechaScreen() {
  const { id, eval: evalId } = useLocalSearchParams<{
    id: string;
    eval?: string;
  }>();
  const { data: plant, isLoading } = usePlant(id);
  const router = useAppRouter();

  // Sin `eval` en la ruta se abre la primera, que es lo que espera quien llega
  // desde un enlace suelto. Uno que no exista cae en lo mismo en vez de dejar
  // la cabecera a medias.
  const current =
    EVALS_POST_COSECHA.find((item) => item.id === evalId) ??
    EVALS_POST_COSECHA[0];

  /**
   * De quién es lo capturado: **la plantación y la evaluación**, no solo la
   * ruta. Saltar de chip es `setParams`, que no desmonta la pantalla, así que
   * comparar solo el `id` dejaría en pantalla lo de «15 días / caja» al entrar
   * en «30 días / caja» — y el autoguardado lo escribiría en la evaluación
   * equivocada.
   */
  const owner = `${id}:${current.id}`;

  const { data: respuestas } = usePostcosechaRespuestas(id, current.id);
  const { data: fotos } = usePostcosechaFotos(id, current.id);

  // **Lo capturado se espera aquí, antes de montar nada.** Las respuestas y las
  // fotografías son consultas aparte de la plantación, y con `gcTime: 0` las
  // respuestas se piden de nuevo en cada visita. Montar las secciones con solo la
  // plantación las pintaba vacías un instante y luego se rellenaban. Hasta que
  // llegan las dos, esqueleto.
  const ready = !!plant && !!respuestas && !!fotos;

  // El bloque va superpuesto, así que su hueco se reserva con un espaciador y
  // hay que medirlo. Si no se renderiza, no hay hueco que reservar.
  const showHeaderExtras = isLoading || !!plant;
  const [headerExtrasHeight, setHeaderExtrasHeight] = useState(0);
  const reservedHeight = showHeaderExtras ? headerExtrasHeight : 0;

  const [progressBarHeight, setProgressBarHeight] = useState(0);

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

  // Abierta al entrar, como las de tratamiento.
  const [photosOpen, setPhotosOpen] = useState(true);

  // Sin memo, cualquier re-render reconstruye este objeto y empuja opciones
  // nuevas al navigator. Depende solo de los dos nombres, no del objeto `plant`
  // entero, para que un refetch que devuelva lo mismo no cuente como cambio.
  const plantName = plant?.name;
  const evalName = `${current.title} - ${current.subtitle}`;
  const screenOptions = useMemo(
    () => ({
      title: evalName,
      header: () => (
        <PostcosechaPageHeader
          plantId={id}
          evalId={current.id}
          plantName={plantName}
          evalName={evalName}
          isLoading={isLoading}
        />
      ),
    }),
    [id, current.id, plantName, evalName, isLoading],
  );

  return (
    <View className="flex-1 bg-background">
        <Stack.Screen options={screenOptions} />

        {/* Datos de la plantación y acceso rápido a las demás evaluaciones.
        Comparte `bg-primary` con el header para leerse como parte de él, igual
        que en la pantalla de tratamiento. */}
        {showHeaderExtras && (
          // El posicionamiento va en un `View` normal y la animación en el
          // `Animated.View` de dentro: no se superponen NativeWind y Reanimated
          // sobre el mismo elemento. `overflow-hidden` es lo que hace que parezca
          // meterse bajo el header, y `box-none` deja pasar los toques cuando el
          // bloque está escondido.
          <View
            pointerEvents="box-none"
            className="absolute top-0 left-0 right-0 z-10 overflow-hidden"
          >
            <Animated.View style={animatedStyle}>
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
                  plant && <PlantFields plant={plant} />
                )}

                {/* Las cuatro siempre, con la actual resaltada — no solo las
                otras tres: así la barra no cambia de contenido al saltar, que
                es lo que la hace navegable con el dedo sin mirar. Los márgenes
                negativos dejan que el scroll llegue a los bordes sin perder el
                padding del contenido. */}
                <ScrollView
                  className="-mx-4"
                  contentContainerClassName="flex-row items-center gap-4 px-4 pb-2"
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {EVALS_POST_COSECHA.map((item) => (
                    <PostcosechaChip
                      key={item.id}
                      evaluacion={item}
                      isActive={item.id === current.id}
                      // Mismo screen, otro parámetro: `setParams` no navega, así
                      // que el chip se invierte en el mismo frame del toque.
                      onPress={() => router.setParams({ eval: item.id })}
                    />
                  ))}
                </ScrollView>
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

        {/* Las secciones nacen abiertas, así que montarlas cuesta un rato en
          el que el hilo de JS no puede pintar nada: sin esto la pantalla es un
          hueco en blanco. Dura hasta que llega **todo** —plantación,
          respuestas y fotografías— y se ata a `plant && !ready` y no a
          `!plant`: con la plantación podada lo que toca es el `EmptyState`, no
          un esqueleto esperando algo que no va a llegar. */}
        {(isLoading || (plant && !ready)) && (
          <SectionSkeleton
            rows={SKELETON_ROWS}
            reservedHeight={reservedHeight}
          />
        )}

        {/* Alcanzable de verdad, no defensivo: una descarga puede podar la
        plantación mientras esta pantalla está abierta. */}
        {!isLoading && !plant && (
          <EmptyState
            icon={GhostIcon}
            title="Plantación no disponible"
            body="Puede que se haya eliminado en la última descarga."
          />
        )}

        {/* La `key` es lo que vacía el formulario y reinicia el autoguardado al
          saltar de evaluación: cada una tiene el suyo, nacido ya con sus
          respuestas. Sin ella el autoguardado escribiría lo de la anterior
          dentro de la nueva. */}
        {ready && (
          <PostcosechaForm
            key={owner}
            plantId={id}
            evalId={current.id}
            respuestas={respuestas}
            reservedHeight={reservedHeight}
            onScroll={scrollHandler}
            photosOpen={photosOpen}
            onTogglePhotos={() => setPhotosOpen((open) => !open)}
          />
        )}
    </View>
  );
}

type PostcosechaFormProps = {
  plantId: string;
  evalId: string;
  respuestas: PostcosechaRespuestaRecord[];
  reservedHeight: number;
  onScroll: ComponentProps<typeof KeyboardAwareScrollView>["onScroll"];
  photosOpen: boolean;
  onTogglePhotos: () => void;
};

/**
 * El formulario de una evaluación de post-cosecha y lo que cuelga de él.
 *
 * **Nace con las respuestas ya puestas** y se monta solo cuando ya están: por eso
 * desaparecieron el `reset` en un efecto, el `previousOwner` y el `loadedFor`. Un
 * formulario que solo lee sus valores iniciales al nacer no puede pisar lo que se
 * teclea ni enseñar un cuadro en blanco entre pintar y volcar.
 *
 * El precio es que **cada salto de chip remonta las secciones** (~400 ms), con su
 * esqueleto. Antes se vaciaban en el sitio con un `reset`.
 *
 * Sin `resolver`: nada se envía. El papel de `postcosechaSchema` es hacer de
 * portero al volcar lo que sale de SQLite y tipar el formulario, no validar al
 * capturar.
 */
function PostcosechaForm({
  plantId,
  evalId,
  respuestas,
  reservedHeight,
  onScroll,
  photosOpen,
  onTogglePhotos,
}: PostcosechaFormProps) {
  // Una sola vez: `useForm` solo lee los iniciales al nacer.
  const [defaultValues] = useState(() =>
    buildPostcosechaFromRespuestas(respuestas),
  );
  const form = useForm<PostcosechaFormValues>({ defaultValues });

  return (
    // Solo alcanza a este árbol: el header del navigator se pinta fuera de él y
    // no ve este contexto — por eso el estado de guardado viaja por el store.
    <FormProvider {...form}>
      {/* No pinta nada: guarda y le cuenta a la cabecera cómo va. */}
      <PostcosechaAutosave plantId={plantId} evalId={evalId} />

      {/* `KeyboardAwareScrollView` y no un `ScrollView` normal: `scrollHandler`
        es un worklet de `useAnimatedScrollHandler`, y un ScrollView de React
        Native intenta llamarlo como función y revienta con «Object is not a
        function». Este por dentro es un `Reanimated.ScrollView`, así que lo
        deja pasar — y es el mismo que usa la pantalla de tratamiento. */}
      <KeyboardAwareScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerClassName="px-4 pb-10"
      >
        {/* Reserva el hueco del bloque superpuesto. Sin holgura extra: la
          primera cabecera ya trae la suya. */}
        <View style={{ height: reservedHeight }} />

        <View className="bg-background pt-4">
          <CollapsibleHeader
            icon={CameraIcon}
            title="Fotografías"
            description="Evidencia de los racimos."
            summary={
              <PostcosechaPhotosHeaderSummary plantId={plantId} evalId={evalId} />
            }
            open={photosOpen}
            onToggle={onTogglePhotos}
          />
        </View>
        <CollapsibleBody open={photosOpen}>
          <PostcosechaPhotosForm plantId={plantId} evalId={evalId} />
        </CollapsibleBody>

        <PostcosechaFrutaSection evalId={evalId} />

        <PostcosechaComentariosSection />
      </KeyboardAwareScrollView>
    </FormProvider>
  );
}
