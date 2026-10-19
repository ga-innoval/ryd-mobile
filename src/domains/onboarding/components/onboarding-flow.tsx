import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import {
  BellIcon,
  CameraIcon,
  CheckIcon,
  ChevronLeftIcon,
  CircleAlertIcon,
  CloudDownloadIcon,
  LeafIcon,
  PackageIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAuthStore } from "@/domains/auth/store/auth-store";
import { usePlantsMutation } from "@/domains/plants/hooks/use-plants-mutation";
import { cn } from "@/lib/utils";
import { usePermissionStep } from "../hooks/use-permission-step";
import { downloadResultBody } from "../lib/download-copy";
import { cameraPermission, notificationsPermission } from "../lib/permissions";
import { useOnboardingStore } from "../store/onboarding-store";
import { IndeterminateBar } from "./indeterminate-bar";
import { PrimaryAction, SecondaryAction } from "./onboarding-actions";
import { OnboardingCard, type OnboardingRow } from "./onboarding-card";
import { OnboardingHero } from "./onboarding-hero";
import { PageIndicator } from "./page-indicator";

const STEPS = 3;
const LAST = STEPS - 1;

const CAMERA_ROWS: OnboardingRow[] = [
  {
    icon: CheckIcon,
    text: "Solo se usa al tomar una foto dentro de una encuesta.",
  },
  {
    icon: CheckIcon,
    text: "Se guarda en la tablet al instante, aunque no haya señal.",
  },
  { icon: CheckIcon, text: "Se envía al servidor cuando sincronizas." },
];

const NOTIFICATION_ROWS: OnboardingRow[] = [
  {
    icon: CloudDownloadIcon,
    text: "Plantaciones nuevas asignadas a tu usuario.",
  },
  {
    icon: CircleAlertIcon,
    tone: "warn",
    text: "Encuestas cerradas por un administrador o datos por revisar.",
  },
  {
    icon: PackageIcon,
    tone: "neutral",
    text: "Recordatorios de post-cosecha a 15 y 30 días.",
  },
];

const PLANTS_ROWS: OnboardingRow[] = [
  {
    icon: LeafIcon,
    text: "Tus plantaciones, con sus tratamientos y evaluaciones de post-cosecha.",
  },
  {
    icon: WifiOffIcon,
    text: "Después puedes capturar sin conexión y sincronizar cuando quieras.",
  },
];

/**
 * Los tres pasos del onboarding como **un modal sobre la pantalla principal**: el
 * dibujo de la cabecera y los botones se quedan quietos y cambian según la
 * página, y lo de en medio —título, texto y tarjeta— se desliza en horizontal con
 * paginación.
 *
 * **No se puede cerrar de otra forma**: ni tocando el fondo ni con el botón de
 * atrás de Android. Solo «Omitir» o terminar los pasos lo dan por completado y lo
 * cierran. Reiniciar la app sin hacer ninguna de las dos lo vuelve a enseñar.
 *
 * Una sola pantalla y no tres rutas porque el estado de la descarga y el del
 * permiso viven aquí. Y el indicador de paso lee el desplazamiento del propio
 * pager, así que se llena con el dedo en vez de saltar al soltar.
 */
export function OnboardingFlow({ onClose }: { onClose: () => void }) {
  const { height: windowHeight } = useWindowDimensions();

  const userId = useAuthStore((state) => state.user?.id);
  const markCompleted = useOnboardingStore((state) => state.markCompleted);

  const scroll = useAnimatedRef<Animated.ScrollView>();
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);

  // El pager y el indicador comparten estos dos valores, en el hilo de la
  // interfaz: así el indicador no depende de un re-render por cada fotograma.
  const widthSV = useSharedValue(0);
  const progress = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    if (widthSV.value > 0) {
      progress.value = event.contentOffset.x / widthSV.value;
    }
  });

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(LAST, next));

      setPage(clamped);
      scroll.current?.scrollTo({ x: clamped * width, animated: true });
    },
    [scroll, width],
  );

  // Sin esto, girar la tablet deja el pager entre dos páginas: el ancho cambia
  // pero el desplazamiento no.
  useEffect(() => {
    if (width > 0) {
      scroll.current?.scrollTo({ x: page * width, animated: false });
    }
    // Solo cuando cambia el ancho: `page` ya se refleja en el desplazamiento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (width > 0) {
      setPage(Math.round(event.nativeEvent.contentOffset.x / width));
    }
  };

  const finish = useCallback(() => {
    if (userId) markCompleted(userId);
    onClose();
  }, [userId, markCompleted, onClose]);

  const next = useCallback(() => goTo(page + 1), [goTo, page]);
  const camera = usePermissionStep(cameraPermission, next);
  const notifications = usePermissionStep(notificationsPermission, next);

  // Sin toast de éxito: la propia página ya cuenta el resultado. Tampoco el de
  // error se vería: el modal tapa el toaster, así que el error va en el texto.
  const download = usePlantsMutation({ announce: false });
  const downloading = download.isPending;
  const done = download.isSuccess;

  const busy = camera.busy || notifications.busy || downloading;

  // **Terminar el último paso es completarlo**: la descarga lista cuenta aunque
  // el usuario no llegue a pulsar «Empezar a capturar» y cierre la app. Llegar a
  // la última página, en cambio, no: cerrar la app ahí tiene que volver a
  // enseñarlo.
  useEffect(() => {
    if (done && userId) markCompleted(userId);
  }, [done, userId, markCompleted]);

  const lastTitle = done
    ? "Todo está listo"
    : downloading
      ? "Descargando tus plantaciones"
      : "Descarga tus plantaciones";
  const lastBody = done
    ? downloadResultBody(download.data.count)
    : downloading
      ? "Mantén la app abierta un momento. Esto solo toma unos segundos."
      : download.isError
        ? "No se pudo descargar. Revisa tu conexión e inténtalo de nuevo."
        : "Para empezar, trae a la tablet las plantaciones que tienes asignadas.";

  const pages = [
    {
      title: "Fotografía la fruta directo en la encuesta",
      body: "Necesitamos acceso a la cámara para documentar la fruta de cada tratamiento y de la post-cosecha mientras capturas.",
      content: <OnboardingCard rows={CAMERA_ROWS} />,
    },
    {
      title: "Entérate de lo importante sin abrir la app",
      body: "CapExp envía notificaciones cuando hay algo que requiere tu atención relevante a las capturas.",
      content: <OnboardingCard rows={NOTIFICATION_ROWS} />,
    },
    {
      title: lastTitle,
      body: lastBody,
      content: downloading ? (
        <IndeterminateBar />
      ) : done ? null : (
        <OnboardingCard rows={PLANTS_ROWS} />
      ),
    },
  ];

  const hero = [
    { icon: CameraIcon },
    { icon: BellIcon, badge: "3" },
    { icon: done ? CheckIcon : CloudDownloadIcon, done, pulsing: downloading },
  ][page];

  const actions =
    page === 0 ? (
      <>
        <PrimaryAction
          label="Permitir acceso a la cámara"
          onPress={camera.run}
          disabled={busy}
        />
        <SecondaryAction label="Ahora no" onPress={next} />
      </>
    ) : page === 1 ? (
      <>
        <PrimaryAction
          label="Activar notificaciones"
          onPress={notifications.run}
          disabled={busy}
        />
        <SecondaryAction label="Ahora no" onPress={next} />
      </>
    ) : done ? (
      <PrimaryAction label="Empezar a capturar" onPress={finish} />
    ) : downloading ? (
      <PrimaryAction label="Descargando…" onPress={() => {}} disabled />
    ) : (
      <>
        <PrimaryAction
          label={
            download.isError ? "Reintentar descarga" : "Descargar plantaciones"
          }
          onPress={() => download.mutate()}
        />
        <SecondaryAction label="Más tarde" onPress={finish} />
      </>
    );

  // «Atrás» y «Omitir» solo cuando no hay nada en curso ni está todo hecho.
  const showNav = !downloading && !done && !camera.busy && !notifications.busy;

  return (
    <Modal
      transparent
      animationType="fade"
      statusBarTranslucent
      // Obligatorio en Android y a propósito sin efecto: el botón de atrás no
      // cierra el modal. Solo «Omitir» o terminar los pasos lo cierran.
      onRequestClose={() => {}}
    >
      <View className="flex-1 items-center justify-center bg-black/55 px-6">
        <View
          style={{ maxHeight: windowHeight * 0.92 }}
          className="w-full max-w-[560px] overflow-hidden rounded-[28px] bg-background"
          accessibilityViewIsModal
        >
          <View className="h-44 items-center justify-center bg-primary">
            {showNav && page > 0 && (
              <Pressable
                onPress={() => goTo(page - 1)}
                accessibilityRole="button"
                accessibilityLabel="Atrás"
                className="absolute left-4 top-4 size-9 items-center justify-center rounded-full border border-white/45"
              >
                <Icon as={ChevronLeftIcon} size={18} className="text-white" />
              </Pressable>
            )}
            {showNav && (
              <Pressable
                onPress={finish}
                accessibilityRole="button"
                className="absolute right-3 top-3 px-3 py-2.5"
              >
                <Text className="font-medium text-white/80">Omitir</Text>
              </Pressable>
            )}

            <OnboardingHero
              icon={hero.icon}
              badge={"badge" in hero ? hero.badge : undefined}
              done={"done" in hero ? hero.done : false}
              pulsing={"pulsing" in hero ? hero.pulsing : false}
            />
          </View>

          <View className="flex-shrink px-9 pt-6">
            <View className="flex-row items-center">
              <PageIndicator progress={progress} count={STEPS} />
              <Text className="ml-auto text-xs font-semibold tracking-widest text-muted-foreground">
                {`PASO ${page + 1} DE ${STEPS}`}
              </Text>
            </View>
          </View>

          <View
            className="flex-shrink"
            onLayout={(e) => {
              const measured = e.nativeEvent.layout.width;

              widthSV.value = measured;
              setWidth(measured);
            }}
          >
            {width > 0 && (
              <Animated.ScrollView
                ref={scroll}
                horizontal
                pagingEnabled
                scrollEnabled={!busy}
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                onMomentumScrollEnd={handleMomentumEnd}
              >
                {pages.map((item, index) => (
                  <ScrollView
                    key={index}
                    style={{ width }}
                    contentContainerClassName={cn("gap-4 px-9 pb-1 pt-4")}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text className="text-xl font-bold leading-8 tracking-tight">
                      {item.title}
                    </Text>
                    <Text className="text-sm leading-6 text-muted-foreground">
                      {item.body}
                    </Text>

                    {item.content}
                  </ScrollView>
                ))}
              </Animated.ScrollView>
            )}
          </View>

          <View className="gap-1 px-9 pb-7 pt-3">{actions}</View>
        </View>
      </View>
    </Modal>
  );
}
