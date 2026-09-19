import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  ArrowLeft,
  CheckIcon,
  ImagesIcon,
  Share2Icon,
  ShareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react-native";
import type { TriggerRef } from "@rn-primitives/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { PhotoGallery, type PhotoRect } from "@/components/photo-gallery";
import { HeaderBase } from "@/domains/navigation/header-base";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { TextButton } from "@/components/ui/text-button";
import { Text } from "@/components/ui/text";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EMPTY_PHOTOS,
  usePhotosStore,
} from "@/domains/plants/store/photos-store";
import { Separator } from "@/components/ui/separator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "@/lib/haptics";

const GAP = 8;
const PADDING = 8;
/** Ancho mínimo de miniatura; de ahí sale cuántas columnas caben. */
const MIN_CELL = 180;

/**
 * Solo iOS dibuja `presentation: "modal"` como un sheet; Android la presenta
 * como una pantalla más. De ahí que la acción cambie de sitio y de icono: en
 * el sheet se *cierra* (X a la derecha) y en la pantalla se *vuelve* (flecha a
 * la izquierda, como el resto de la app).
 */
const PRESENTS_AS_SHEET = Platform.OS === "ios";

/** Cuánto encoge la foto al seleccionarse, dentro de su misma celda. */
const SELECTED_SCALE = 0.9;
const SELECTION_DURATION_MS = 100;

/**
 * Va en el cuerpo de la pantalla y no por `options.header` del navigator, y no
 * es un rodeo: con un header propio, native-stack apaga la barra nativa y tu
 * elemento acaba siendo contenido de la pantalla igualmente
 * (`NativeStackView.native.js`, `headerShown: header !== undefined ? false :
 * headerShown`). Pasando por el navigator, además, el elemento queda detrás de
 * una guarda —`header != null && headerShown !== false`— que en modal no se
 * cumplía y lo dejaba sin pintar, sin ningún error. Aquí siempre se pinta.
 */
function PhotosHeader({
  count,
  isSelecting,
  onToggleSelecting,
  onDismiss,
}: {
  count: number;
  isSelecting: boolean;
  onToggleSelecting: () => void;
  onDismiss: () => void;
}) {
  const title = (
    <>
      <Icon size={16} as={ImagesIcon} className="text-leaf" />
      <Text className="font-bold text-primary-foreground">Fotografías</Text>
      <Text className="text-primary-foreground/40">/</Text>
      <Text className="font-medium text-primary-foreground/80">{count}</Text>
    </>
  );

  // Sin fotos no hay nada que seleccionar, así que el botón ni aparece.
  const selectButton = count > 0 && (
    <TextButton onPress={onToggleSelecting}>
      {isSelecting ? "Cancelar" : "Seleccionar"}
    </TextButton>
  );

  if (PRESENTS_AS_SHEET) {
    return (
      <HeaderBase>
        <View className="flex-row items-center gap-3">{title}</View>
        <View className="flex-row items-center gap-2">
          {selectButton}
          <IconButton onPress={onDismiss} aria-label="Cerrar">
            <Icon size={16} as={XIcon} className="text-white" />
          </IconButton>
        </View>
      </HeaderBase>
    );
  }

  return (
    <HeaderBase>
      <View className="flex-row items-center gap-3">
        <IconButton onPress={onDismiss} className="mr-4" aria-label="Volver">
          <Icon size={16} as={ArrowLeft} className="text-white" />
        </IconButton>
        {title}
      </View>
      {selectButton}
    </HeaderBase>
  );
}

function selectionLabel(count: number) {
  if (count === 0) return "Selecciona fotografías";
  if (count === 1) return "1 foto seleccionada";

  return `${count} fotografías seleccionadas`;
}

/**
 * Acciones del modo selección.
 *
 * Va como hermana de la lista y no superpuesta: así la cuadrícula se encoge y
 * la última fila no queda tapada por la barra.
 */
function SelectionBar({
  count,
  onDelete,
}: {
  count: number;
  onDelete: () => void;
}) {
  const { bottom } = useSafeAreaInsets();

  return (
    <View
      style={{ paddingBottom: bottom + 12 }}
      className="flex-row items-center justify-between bg-card border-border border px-6 pt-3"
    >
      {/* TODO(compartir): ni `Share` de React Native ni `expo-sharing` mandan
          varios archivos a la vez, y falta decidir si esto comparte el archivo
          o exporta la evaluación entera. Deshabilitado a propósito, en vez de
          fingir que hace algo. */}
      <IconButton variant="onLight" disabled aria-label="Compartir">
        <Icon
          size={16}
          as={Platform.OS === "android" ? Share2Icon : ShareIcon}
        />
      </IconButton>

      <Text className="font-medium">{selectionLabel(count)}</Text>

      <IconButton
        variant="onLight"
        disabled={count === 0}
        onPress={onDelete}
        aria-label="Eliminar"
      >
        {/* Sin color: lo pone la variante por `TextClassContext`. */}
        <Icon size={16} as={Trash2Icon} />
      </IconButton>
    </View>
  );
}

/**
 * Una miniatura de la cuadrícula.
 *
 * Es un componente de módulo y no un `renderItem` en línea porque necesita su
 * propia ref para el menú, y porque definirlo dentro de la pantalla lo
 * remontaría —y con él la imagen— en cada render de la pantalla.
 *
 * El menú se monta por celda en vez de uno compartido: anclar uno solo
 * obligaría a seguir el scroll a mano para saber dónde está la miniatura. La
 * lista está virtualizada, así que solo hay montadas las de un par de
 * pantallas.
 */
function PhotoCell({
  uri,
  index,
  size,
  isSelecting,
  isSelected,
  onPress,
  onOpenChange,
  onDelete,
}: {
  uri: string;
  index: number;
  size: number;
  isSelecting: boolean;
  isSelected: boolean;
  /** Recibe el hueco de la miniatura, salvo en modo selección. */
  onPress: (origin?: PhotoRect) => void;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  const triggerRef = useRef<TriggerRef>(null);
  const cellRef = useRef<View>(null);

  // La medida se pide aquí y no en la pantalla porque solo la celda sabe
  // dónde está. `measureInWindow` da coordenadas de ventana, que es el mismo
  // sistema en el que vive el `Modal` del visor.
  //
  // En modo selección no se mide: el toque solo marca, y medir metería un
  // salto asíncrono entre el dedo y la insignia.
  const handlePress = () => {
    if (isSelecting) {
      onPress();
      return;
    }

    cellRef.current?.measureInWindow((x, y, width, height) =>
      onPress({ x, y, width, height }),
    );
  };

  // El patrón de la casa para animar sobre una prop: shared value +
  // `useEffect` + `withTiming`. Nunca las clases `animate-*` de NativeWind,
  // que escriben el shared value durante el render.
  const selection = useSharedValue(isSelected ? SELECTED_SCALE : 1);

  useEffect(() => {
    selection.value = withTiming(isSelected ? SELECTED_SCALE : 1, {
      duration: SELECTION_DURATION_MS,
    });
  }, [isSelected, selection]);

  const selectionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: selection.value }],
  }));

  const handleOnLongPress = isSelecting
    ? undefined
    : () => {
        haptics.tap();
        triggerRef.current?.open();
      };

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <Pressable
        ref={cellRef}
        onPress={handlePress}
        // El menú se abre por la ref del disparador y no desde su `onPress`:
        // ese toque ya está ocupado abriendo el visor. `open()` mide además la
        // posición, que es lo que necesita el contenido para salir pegado a la
        // miniatura.
        //
        // En modo selección no hay menú: el long press y el press llevarían a
        // la misma acción por dos caminos, y el menú pisaría a la barra.
        onLongPress={handleOnLongPress}
        role="button"
        aria-label={
          isSelecting
            ? `Seleccionar la fotografía ${index + 1}`
            : `Ver la fotografía ${index + 1}`
        }
        aria-selected={isSelecting ? isSelected : undefined}
        style={{ width: size, height: size }}
        className="overflow-hidden rounded-xl bg-background"
      >
        {/* La celda conserva su tamaño y es la foto la que encoge, así que la
            cuadrícula no se mueve y lo que asoma alrededor es el fondo de la
            propia celda. El estilo animado va en el envoltorio y el
            `className` en el hijo: no se superponen Reanimated y NativeWind
            sobre el mismo elemento. */}
        <Animated.View style={[styles.photo, selectionStyle]}>
          <Image
            source={uri}
            contentFit="cover"
            // Sin esto, al reciclar la celda se ve un frame la foto anterior.
            recyclingKey={uri}
            // iOS decodifica una miniatura del tamaño de la celda en vez de
            // la foto entera. Con cientos de fotos, decodificarlas completas
            // para pintarlas en 180 px no se sostiene en memoria.
            enforceEarlyResizing
            // El radio va aquí y no en el envoltorio animado: así la foto
            // encogida conserva las esquinas sin duplicar el valor fuera de
            // Tailwind.
            className="flex-1 rounded-xl"
          />
        </Animated.View>

        {/* El encogido ya distingue la elegida, pero por sí solo se lee como
            "pulsada". La insignia es lo que dice que está marcada, y solo
            aparece en modo selección: fuera de él, el encogido es del menú. */}
        {isSelecting && isSelected && (
          <View className="absolute bottom-1.5 right-1.5 size-6 items-center justify-center rounded-full border-2 border-white bg-primary">
            <Icon
              size={14}
              strokeWidth={3}
              as={CheckIcon}
              className="text-white"
            />
          </View>
        )}

        {/* Solo es el ancla del menú: mide la celda y no recibe toques, para no
            quitarle ni el press ni el long press a la miniatura. */}
        <DropdownMenuTrigger
          ref={triggerRef}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      </Pressable>

      <DropdownMenuContent>
        <DropdownMenuItem variant="default">
          <Icon
            as={Platform.OS === "android" ? Share2Icon : ShareIcon}
            size={16}
            className="text-foreground"
          />
          <Text>Compartir</Text>
        </DropdownMenuItem>
        <Separator />
        <DropdownMenuItem variant="destructive" onPress={onDelete}>
          <Icon as={Trash2Icon} size={16} className="text-destructive" />
          <Text>Eliminar</Text>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Cuadrícula con todas las fotografías de una sección de la encuesta, en
 * presentación modal. Al tocar una se abre el visor por esa misma.
 *
 * Las URIs no viajan por params sino por el store: pueden ser cientos, y no
 * cabe darlas por pocas cuando ni siquiera está puesto el tope.
 */
export default function PhotosScreen() {
  const { sectionId } = useLocalSearchParams<{ sectionId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const photos = usePhotosStore(
    (state) => state.photos[sectionId] ?? EMPTY_PHOTOS,
  );

  // `undefined` es "cerrado": el índice por el que abre el visor y su
  // visibilidad son el mismo dato, así que no pueden discrepar.
  const [galleryIndex, setGalleryIndex] = useState<number>();
  const [galleryOrigin, setGalleryOrigin] = useState<PhotoRect>();

  // La selección **es** el menú abierto, no un estado aparte que pudiera
  // discrepar de él: lo pone y lo quita el propio `onOpenChange`.
  const [selectedIndex, setSelectedIndex] = useState<number>();

  const removePhotos = usePhotosStore((state) => state.removePhotos);

  const [isSelecting, setIsSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());

  // Entrar y salir limpian lo elegido: al volver a entrar se empieza de cero,
  // que es lo que espera quien pulsa "Cancelar".
  const toggleSelecting = useCallback(() => {
    setIsSelecting((prev) => !prev);
    setSelected(new Set());
  }, []);

  const toggleSelected = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(index)) next.delete(index);
      else next.add(index);

      return next;
    });
  }, []);

  // Todas de una vez: borrar de una en una desplazaría los índices siguientes
  // y se llevaría por delante fotos que nadie eligió.
  const deleteSelected = useCallback(() => {
    removePhotos(sectionId, [...selected]);
    setIsSelecting(false);
    setSelected(new Set());
  }, [removePhotos, sectionId, selected]);

  const columns = Math.max(2, Math.floor(width / MIN_CELL));
  // Tamaño explícito y no `flex-1`: con `flex-1`, una última fila incompleta
  // estiraría sus celdas hasta ocupar el ancho entero.
  const cellSize = (width - PADDING * 2 - GAP * (columns - 1)) / columns;

  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <PhotoCell
        uri={item}
        index={index}
        size={cellSize}
        isSelecting={isSelecting}
        // Fuera del modo selección, lo "seleccionado" es la celda cuyo menú
        // está abierto; dentro, lo que se ha ido marcando.
        isSelected={isSelecting ? selected.has(index) : selectedIndex === index}
        onPress={(origin) => {
          if (isSelecting) {
            toggleSelected(index);
            return;
          }

          setGalleryOrigin(origin);
          setGalleryIndex(index);
        }}
        onOpenChange={(open) => setSelectedIndex(open ? index : undefined)}
        onDelete={() => removePhotos(sectionId, [index])}
      />
    ),
    [
      cellSize,
      isSelecting,
      selected,
      selectedIndex,
      toggleSelected,
      sectionId,
      removePhotos,
    ],
  );

  const emptyComponent = useMemo(
    () => (
      <EmptyState
        icon={ImagesIcon}
        title="Sin fotografías"
        body="Las que captures en esta sección aparecerán aquí."
      />
    ),
    [],
  );

  return (
    <View className="flex-1 bg-background">
      <PhotosHeader
        count={photos.length}
        isSelecting={isSelecting}
        onToggleSelecting={toggleSelecting}
        onDismiss={() => router.back()}
      />

      <FlatList
        data={photos}
        // FlatList no admite cambiar de columnas en caliente: avisa por consola
        // y pide remontar con la clave, que es lo que hace esto al girar.
        key={columns}
        numColumns={columns}
        // El índice entra en la clave porque la misma foto puede elegirse dos
        // veces de la galería y repetir URI.
        keyExtractor={(uri, index) => `${uri}-${index}`}
        renderItem={renderItem}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, padding: PADDING }}
        ListEmptyComponent={emptyComponent}
      />

      {isSelecting && (
        <SelectionBar count={selected.size} onDelete={deleteSelected} />
      )}

      <PhotoGallery
        photos={photos}
        visible={galleryIndex !== undefined}
        initialIndex={galleryIndex}
        origin={galleryOrigin}
        onClose={() => setGalleryIndex(undefined)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { flex: 1 },
});
