import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
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
import { EVALS_POST_COSECHA } from "@/domains/plants/lib/evals-post-cosecha";

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

  // El bloque va superpuesto, así que su hueco se reserva con un espaciador y
  // hay que medirlo. Si no se renderiza, no hay hueco que reservar.
  const showHeaderExtras = isLoading || !!plant;
  const [headerExtrasHeight, setHeaderExtrasHeight] = useState(0);
  const reservedHeight = showHeaderExtras ? headerExtrasHeight : 0;

  const { scrollHandler, animatedStyle } = useHideOnScroll({
    distance: reservedHeight,
  });

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
          plantName={plantName}
          evalName={evalName}
          isLoading={isLoading}
        />
      ),
    }),
    [plantName, evalName, isLoading],
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
              className="bg-primary gap-3 px-4 pb-3 pt-1"
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
        </View>
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

      {plant && (
        // `KeyboardAwareScrollView` y no un `ScrollView` normal: `scrollHandler`
        // es un worklet de `useAnimatedScrollHandler`, y un ScrollView de React
        // Native intenta llamarlo como función y revienta con «Object is not a
        // function». Este por dentro es un `Reanimated.ScrollView`, así que lo
        // deja pasar — y es el mismo que usa la pantalla de tratamiento.
        <KeyboardAwareScrollView
          onScroll={scrollHandler}
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
                <PostcosechaPhotosHeaderSummary
                  plantId={id}
                  evalId={current.id}
                />
              }
              open={photosOpen}
              onToggle={() => setPhotosOpen((open) => !open)}
            />
          </View>
          <CollapsibleBody open={photosOpen}>
            {/* `key` para que al saltar de evaluación empiece de cero: lo
              capturado es de esta, no de la siguiente. */}
            <PostcosechaPhotosForm
              key={current.id}
              plantId={id}
              evalId={current.id}
            />
          </CollapsibleBody>

          {/* El `key` es lo que vacía cada sección al saltar de evaluación, y
            va con prefijo porque estas dos son hermanas: con la evaluación a
            secas las dos se llamarían `15caja` y React avisa de claves
            repetidas. El prefijo es lo que las distingue, no adorno. */}
          <PostcosechaFrutaSection
            key={`fruta-${current.id}`}
            evalId={current.id}
          />

          <PostcosechaComentariosSection key={`comentarios-${current.id}`} />
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}
