import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { XIcon } from "lucide-react-native";
import Animated, {
  clamp,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

const BAR_HEIGHT = 54;
const BAR_TIMING = { duration: 250 };
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50 };

/** Cuánto hay que arrastrar antes de que el gesto decida que es suyo. */
const DRAG_ACTIVATION = 20;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
const MIN_BACKDROP_OPACITY = 0.4;
const MIN_CONTENT_SCALE = 0.85;
const SPRING = { damping: 60, stiffness: 600 };

/** Lo que tarda la foto en crecer desde la miniatura, y en volver. */
const ENTER_MS = 260;
const EXIT_MS = 220;
/** Sin rectángulo de origen, entra creciendo un poco desde el centro. */
const FALLBACK_ENTER_SCALE = 0.9;

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
/** Por debajo de esto el pellizco cuenta como "volver a 1", no como zoom. */
const ZOOM_EPSILON = 1.01;

type ZoomValues = {
  activeIndex: SharedValue<number>;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
};

/** Rectángulo en coordenadas de ventana, tal como lo da `measureInWindow`. */
export type PhotoRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PhotoGalleryProps = {
  photos: string[];
  visible: boolean;
  /** Por dónde abrir. Fuera de rango equivale a la primera. */
  initialIndex?: number;
  /**
   * De dónde crece la foto al abrir: la miniatura que se pulsó. Sin él, entra
   * con un crecido corto desde el centro. Solo se usa al abrir — al cerrar el
   * visor se desvanece donde esté, sin volver al hueco.
   */
  origin?: PhotoRect;
  onClose: () => void;
};

/**
 * Visor de fotografías a pantalla completa: se pasa de una a otra con swipes
 * horizontales, se acerca con pellizco o doble toque, y se cierra arrastrando
 * hacia abajo como la galería de iOS.
 *
 * Genérico a propósito —solo sabe de URIs—, igual que `EmptyState`.
 */
export function PhotoGallery({
  photos,
  visible,
  initialIndex,
  origin,
  onClose,
}: PhotoGalleryProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar style="light" />
      <GalleryContent
        photos={photos}
        initialIndex={initialIndex}
        origin={origin}
        onClose={onClose}
      />
    </Modal>
  );
}

/**
 * Vive dentro del `Modal` a propósito: al cerrarse, el Modal deja de renderizar
 * a sus hijos, así que el desplazamiento del arrastre, el zoom y el estado de
 * las barras arrancan limpios en cada apertura en vez de arrastrar los de la
 * vez anterior.
 */
function GalleryContent({
  photos,
  initialIndex,
  origin,
  onClose,
}: Omit<PhotoGalleryProps, "visible">) {
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  // Y no `Dimensions.get()` a nivel de módulo: esta app gira, y el ancho de
  // página tiene que seguir a la rotación o el paginado se descuadra.
  const { width, height } = useWindowDimensions();

  const startIndex =
    initialIndex !== undefined &&
    initialIndex >= 0 &&
    initialIndex < photos.length
      ? initialIndex
      : 0;

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  // En React y no en un shared value porque apaga el scroll de la lista y el
  // gesto de cierre, que son props.
  const [isZoomed, setIsZoomed] = useState(false);

  const menuProgress = useSharedValue(1);
  const dragOffset = useSharedValue(0);

  // Abrir y cerrar son dos animaciones distintas a propósito, y por eso son
  // dos valores y no uno:
  //
  // `enter` es la **geometría** —0 encajado en la miniatura, 1 a pantalla
  // completa—. Va de 0 a 1 al montar y ya no vuelve: recorrer el camino al
  // revés al cerrar hacía que la foto saliera viajando hasta su hueco, que es
  // justo lo que no se quiere.
  const enter = useSharedValue(0);

  // `exit` es la **opacidad** del cierre. Al apagar sin mover nada, el visor
  // se va donde esté: en su sitio si cierras con el botón, y donde lo
  // soltaste si cierras arrastrando.
  const exit = useSharedValue(1);

  useEffect(() => {
    enter.value = withTiming(1, { duration: ENTER_MS });
  }, [enter]);

  /**
   * Cierra animando primero y avisando después: `onClose` quita el `Modal`, y
   * llamarlo antes cortaría la animación en seco. Por eso el `Modal` ya no
   * tiene `animationType` propio — la transición es esta.
   */
  const requestClose = useCallback(() => {
    exit.value = withTiming(0, { duration: EXIT_MS }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [exit, onClose]);

  // La escala es uniforme y no una por eje: con la miniatura cuadrada y la
  // pantalla apaisada, escalar cada eje por su lado deformaría la foto a la
  // vista. El precio es que el encaje con el hueco no es exacto en alto.
  const enterScale = origin ? origin.width / width : FALLBACK_ENTER_SCALE;
  const enterX = origin ? origin.x + origin.width / 2 - width / 2 : 0;
  const enterY = origin ? origin.y + origin.height / 2 - height / 2 : 0;

  // Un solo juego de valores para el zoom, no uno por página: solo se puede
  // acercar la que se está viendo —mientras hay zoom el scroll está apagado—,
  // así que cada página los aplica únicamente si es la activa.
  const activeIndex = useSharedValue(startIndex);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);

  function resetZoom() {
    "worklet";
    scale.value = withSpring(1, SPRING);
    translateX.value = withSpring(0, SPRING);
    translateY.value = withSpring(0, SPRING);
    savedScale.value = 1;
    runOnJS(setIsZoomed)(false);
  }

  /**
   * Devuelve la imagen dentro de los bordes al soltar. El tope se calcula
   * contra el contenedor y no contra la imagen dibujada: con `contain` la foto
   * está apaisada dentro de su hueco, así que este límite es algo más holgado
   * que el real, pero impide que se vaya de la pantalla sin tener que medir el
   * tamaño renderizado.
   */
  function clampTranslation() {
    "worklet";
    const maxX = (width * (scale.value - 1)) / 2;
    const maxY = (height * (scale.value - 1)) / 2;

    translateX.value = withSpring(clamp(translateX.value, -maxX, maxX), SPRING);
    translateY.value = withSpring(clamp(translateY.value, -maxY, maxY), SPRING);
  }

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      savedScale.value = scale.value;
      // El punto de la imagen que hay bajo los dedos, en coordenadas sin
      // escalar ni desplazar: es lo que hay que mantener ahí mientras se
      // acerca, o el zoom se iría siempre al centro.
      originX.value =
        (event.focalX - width / 2 - translateX.value) / scale.value;
      originY.value =
        (event.focalY - height / 2 - translateY.value) / scale.value;
    })
    .onUpdate((event) => {
      const next = clamp(savedScale.value * event.scale, 1, MAX_ZOOM);

      scale.value = next;
      translateX.value = event.focalX - width / 2 - originX.value * next;
      translateY.value = event.focalY - height / 2 - originY.value * next;
    })
    .onEnd(() => {
      if (scale.value <= ZOOM_EPSILON) {
        resetZoom();
        return;
      }

      savedScale.value = scale.value;
      clampTranslation();
      runOnJS(setIsZoomed)(true);
    });

  // Mover la foto acercada. Solo con zoom: sin él, el arrastre es el de cerrar.
  const zoomPan = Gesture.Pan()
    .enabled(isZoomed)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      clampTranslation();
    });

  // Solo toma el arrastre hacia abajo y con un dedo: hacia arriba falla, el
  // movimiento horizontal se lo deja al scroll de la lista, y el de dos dedos
  // al pellizco.
  const dismissPan = Gesture.Pan()
    .enabled(!isZoomed)
    .maxPointers(1)
    .activeOffsetY(DRAG_ACTIVATION)
    .failOffsetY(-DRAG_ACTIVATION)
    .failOffsetX([-DRAG_ACTIVATION, DRAG_ACTIVATION])
    .onUpdate((event) => {
      dragOffset.value = Math.max(event.translationY, 0);
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.translationY > DISMISS_DISTANCE ||
        event.velocityY > DISMISS_VELOCITY;

      if (shouldDismiss) {
        // Se apaga donde se soltó. Devolverla al centro y desvanecerla
        // después se ve como un tirón.
        runOnJS(requestClose)();
        return;
      }

      dragOffset.value = withSpring(0, SPRING);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1) {
        resetZoom();
        return;
      }

      // Acerca dejando bajo el dedo el punto que se tocó, no el centro.
      const originTapX = event.x - width / 2;
      const originTapY = event.y - height / 2;
      const maxX = (width * (DOUBLE_TAP_ZOOM - 1)) / 2;
      const maxY = (height * (DOUBLE_TAP_ZOOM - 1)) / 2;

      scale.value = withSpring(DOUBLE_TAP_ZOOM, SPRING);
      translateX.value = withSpring(
        clamp(originTapX * (1 - DOUBLE_TAP_ZOOM), -maxX, maxX),
        SPRING,
      );
      translateY.value = withSpring(
        clamp(originTapY * (1 - DOUBLE_TAP_ZOOM), -maxY, maxY),
        SPRING,
      );
      savedScale.value = DOUBLE_TAP_ZOOM;
      runOnJS(setIsZoomed)(true);
    });

  const singleTap = Gesture.Tap().onEnd(() => {
    menuProgress.value = withTiming(menuProgress.value > 0 ? 0 : 1, BAR_TIMING);
  });

  // Los dos arrastres nunca están activos a la vez —se excluyen por `enabled`—,
  // así que componerlos en simultáneo es seguro. Los toques van en exclusiva
  // para que el doble no dispare también el sencillo.
  const gesture = Gesture.Simultaneous(
    pinch,
    zoomPan,
    dismissPan,
    Gesture.Exclusive(doubleTap, singleTap),
  );

  // Las barras se desvanecen con el arrastre: flotando en opacidad 1 mientras
  // el fondo desaparece se ven despegadas de la imagen.
  const dragProgress = useDerivedValue(() =>
    interpolate(
      dragOffset.value,
      [0, DISMISS_DISTANCE],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  );

  // Todo lo que se ve multiplica por los dos: `enter` lo trae con el crecido
  // y `exit` lo apaga al cerrar, sin dejar de responder al arrastre.
  const topBarStyle = useAnimatedStyle(() => ({
    height: menuProgress.value * (topInset + BAR_HEIGHT),
    opacity: menuProgress.value * dragProgress.value * enter.value * exit.value,
  }));

  const bottomBarStyle = useAnimatedStyle(() => ({
    height: menuProgress.value * (bottomInset + BAR_HEIGHT),
    opacity: menuProgress.value * dragProgress.value * enter.value * exit.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity:
      enter.value *
      exit.value *
      interpolate(
        dragOffset.value,
        [0, DISMISS_DISTANCE],
        [1, MIN_BACKDROP_OPACITY],
        Extrapolation.CLAMP,
      ),
  }));

  // Un solo transform para las dos cosas: el desplazamiento de la entrada y
  // el del arrastre se suman, y las escalas se multiplican. En reposo
  // (`enter` a 1) queda exactamente el comportamiento de antes.
  //
  // El cierre no toca esta geometría: es `exit` sobre la opacidad, así que la
  // foto se apaga sin moverse.
  //
  // El orden importa: en React Native el `translate` no lo escala el `scale`
  // que va detrás, así que se lleva el centro al de la miniatura y se encoge
  // alrededor de ese punto.
  const contentStyle = useAnimatedStyle(() => {
    const dragScale = interpolate(
      dragOffset.value,
      [0, DISMISS_DISTANCE],
      [1, MIN_CONTENT_SCALE],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { translateX: interpolate(enter.value, [0, 1], [enterX, 0]) },
        {
          translateY:
            interpolate(enter.value, [0, 1], [enterY, 0]) + dragOffset.value,
        },
        {
          scale: interpolate(enter.value, [0, 1], [enterScale, 1]) * dragScale,
        },
      ],
      opacity: exit.value,
    };
  });

  const getItemLayout = useCallback(
    (_data: ArrayLike<string> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  // `viewableItems` y no `changed`: `changed` trae también la que acaba de
  // salir de pantalla, así que el contador se quedaba en la anterior.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<string>[] }) => {
      const nextIndex = viewableItems[0]?.index;
      if (nextIndex === null || nextIndex === undefined) return;

      setCurrentIndex(nextIndex);
      activeIndex.value = nextIndex;
    },
    [activeIndex],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <GalleryPage
        uri={item}
        index={index}
        width={width}
        zoom={{ activeIndex, scale, translateX, translateY }}
      />
    ),
    [width, activeIndex, scale, translateX, translateY],
  );

  return (
    // En Android el root de RNGH es una vista nativa y el Modal se monta en
    // otra ventana, fuera del root de la app: sin este envoltorio el gesto no
    // se reconoce y falla en silencio.
    <GestureHandlerRootView style={styles.root}>
      <Animated.View style={[styles.backdrop, backdropStyle]} />
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.content, contentStyle]}>
          <Animated.View
            style={[styles.topBar, { paddingTop: topInset }, topBarStyle]}
          >
            <Pressable onPress={requestClose} hitSlop={16} aria-label="Cerrar">
              <Icon as={XIcon} size={28} className="text-white" />
            </Pressable>
          </Animated.View>

          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            // Con zoom, el arrastre es para mover la foto, no para cambiarla.
            scrollEnabled={!isZoomed && photos.length > 1}
            initialScrollIndex={startIndex}
            getItemLayout={getItemLayout}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={VIEWABILITY_CONFIG}
            // El índice entra en la clave porque la misma foto puede elegirse
            // dos veces de la galería y repetir URI.
            keyExtractor={(uri, index) => `${uri}-${index}`}
            renderItem={renderItem}
          />

          <Animated.View
            style={[
              styles.bottomBar,
              { paddingBottom: bottomInset },
              bottomBarStyle,
            ]}
          >
            <Text className="text-sm text-white/70">
              {currentIndex + 1} / {photos.length}
            </Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

/**
 * Una página del visor. El transform del zoom solo se aplica si es la activa:
 * los valores son compartidos por todas, y sin esta guarda las vecinas se
 * moverían con ella y asomarían por el borde.
 */
function GalleryPage({
  uri,
  index,
  width,
  zoom,
}: {
  uri: string;
  index: number;
  width: number;
  zoom: ZoomValues;
}) {
  const zoomStyle = useAnimatedStyle(() => {
    const isActive = zoom.activeIndex.value === index;

    return {
      transform: [
        { translateX: isActive ? zoom.translateX.value : 0 },
        { translateY: isActive ? zoom.translateY.value : 0 },
        { scale: isActive ? zoom.scale.value : 1 },
      ],
    };
  });

  return (
    <View style={{ width, height: "100%" }}>
      {/* El estilo animado va en el `Animated.View` envolvente y el `className`
          en el hijo: no se superponen Reanimated y NativeWind sobre el mismo
          elemento. */}
      <Animated.View style={[styles.fill, zoomStyle]}>
        <Image source={uri} contentFit="contain" className="flex-1" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "black",
  },
  content: { flex: 1 },
  fill: { flex: 1 },
  topBar: {
    position: "absolute",
    top: 0,
    width: "100%",
    paddingHorizontal: 12,
    alignItems: "flex-end",
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 99,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
