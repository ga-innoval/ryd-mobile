import { Stack, useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Keyboard,
  ScrollView,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Animated, {
  useAnimatedRef,
  useScrollOffset,
} from "react-native-reanimated";
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { useAppRouter } from "@/lib/use-app-router";
import { useHideOnScroll } from "@/lib/use-hide-on-scroll";
import { useTratamiento } from "@/domains/plants/hooks/use-tratamiento";
import { useRespuestas } from "@/domains/plants/hooks/use-respuestas";
import { buildEvaluationFromRespuestas } from "@/domains/plants/lib/build-evaluation-from-respuestas";
import { EvaluationAutosave } from "@/domains/plants/components/evaluation-autosave";
import { EvaluationErrorButton } from "@/domains/plants/components/evaluation-error-button";
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
import {
  EvalQuestionsForm,
  EvalQuestionsHeader,
} from "@/domains/plants/components/eval-questions-form";
import {
  EvalPhotosForm,
  PhotosHeaderSummary,
} from "@/domains/plants/components/eval-photos";
import {
  BrixHeaderSummary,
  EvalBrix,
} from "@/domains/plants/components/eval-brix";
import {
  CribaHeaderSummary,
  EvalCriba,
} from "@/domains/plants/components/eval-criba";
import {
  EvalRendimiento,
  RendimientoHeaderSummary,
} from "@/domains/plants/components/eval-rendimiento";
import {
  ComentariosHeaderSummary,
  EvalComentarios,
} from "@/domains/plants/components/eval-comentarios";
import { usePhotosStore } from "@/domains/plants/store/photos-store";
import {
  buildEvaluationDefaults,
  evaluationSchema,
  EVALUATION_SECTION_IDS,
  type EvaluationFormValues,
  type EvaluationSectionId,
  type EvaluationValues,
  type QuestionsSectionId,
} from "@/domains/plants/lib/evaluation-schema";
import { EVALS_EXTERIOR } from "@/domains/plants/lib/evals-exterior";
import { EVALS_INTERIOR } from "@/domains/plants/lib/evals-interior";
import {
  CameraIcon,
  GaugeCircleIcon,
  GhostIcon,
  GrapeIcon,
  Grid3x3Icon,
  MessageSquareTextIcon,
  MicroscopeIcon,
  PipetteIcon,
  type LucideIcon,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import type { EvalQuestion, PlantRecord } from "@/domains/plants/types";
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

/**
 * Qué lleva cada sección va declarado aquí, en su `kind`, y no como un
 * `id === "..."` suelto en el render, para que esta lista siga describiendo por
 * sí sola lo que lleva cada una.
 *
 * El `id` de las que se capturan en el formulario es también su clave en
 * `evaluationSchema`, y el tipo lo obliga: una errata entre esta lista y el
 * esquema es un error de compilación, no un campo que no se guarda.
 */
type Section = {
  icon: LucideIcon;
  title: string;
  description: string;
} & (
  | { kind: "questions"; id: QuestionsSectionId; questions: EvalQuestion[] }
  // Brix no es un catálogo de preguntas: se captura por cortes, y su avance no
  // es un porcentaje porque no tiene un número fijo de cortes.
  | { kind: "brix"; id: Extract<EvaluationSectionId, "brix"> }
  // Criba tampoco: es una tabla fija de nueve calibres, y lo que resume no es
  // un avance sino el peso de la muestra.
  | { kind: "criba"; id: Extract<EvaluationSectionId, "criba"> }
  // Rendimiento va por cosechas: los cortes que el evaluador agrega, y su
  // resumen son los kilogramos cosechados.
  | { kind: "rendimiento"; id: Extract<EvaluationSectionId, "rendimiento"> }
  // Comentarios son tres notas de texto libre, sin nada que calcular ni que
  // validar.
  | { kind: "comentarios"; id: Extract<EvaluationSectionId, "comentarios"> }
  // Las fotografías no son campos del formulario: viven en su propio store
  // hasta que haya guardado, así que esta sección no tiene clave en el esquema
  // y su `id` solo la identifica en pantalla.
  | { kind: "photos"; id: "fotografias" }
);

/** Lo que cada sección sin preguntas enseña en el hueco del resumen de su
 *  cabecera. Las de preguntas no pasan por aquí: la suya es
 *  `EvalQuestionsHeader`, con su barra de avance. */
function sectionSummary(section: Section): ReactNode {
  switch (section.kind) {
    case "brix":
      return <BrixHeaderSummary />;
    case "criba":
      return <CribaHeaderSummary />;
    case "rendimiento":
      return <RendimientoHeaderSummary />;
    case "comentarios":
      return <ComentariosHeaderSummary />;
    case "photos":
      return <PhotosHeaderSummary />;
    case "questions":
      return undefined;
  }
}

/** El contenido de cada sección. Cada uno lee y escribe lo suyo del formulario
 *  —o del store, en las fotografías—, así que solo hay que montarlo. */
function sectionBody(section: Section, tratamientoId: string): ReactNode {
  switch (section.kind) {
    case "questions":
      return (
        <EvalQuestionsForm
          sectionId={section.id}
          questions={section.questions}
        />
      );
    case "brix":
      // Su estado de interfaz —qué corte está abierto— es del tratamiento; con
      // `setParams` la pantalla no se desmonta.
      return <EvalBrix key={tratamientoId} />;
    case "criba":
      return <EvalCriba />;
    case "rendimiento":
      // Como Brix, los cortes que lleva son del tratamiento: con `setParams` la
      // pantalla no se desmonta.
      return <EvalRendimiento key={tratamientoId} />;
    case "comentarios":
      return <EvalComentarios />;
    case "photos":
      return <EvalPhotosForm />;
  }
}

const SECTIONS: Section[] = [
  {
    id: "fotografias",
    kind: "photos",
    icon: CameraIcon,
    title: "Fotografías",
    description: "Evidencia del racimo y de los dos cortes de la baya.",
  },
  {
    id: "exterior",
    kind: "questions",
    icon: GrapeIcon,
    title: "Evaluación Exterior",
    description: "Forma, color, firmeza y arreglo del racimo y de la baya.",
    questions: EVALS_EXTERIOR,
  },
  {
    id: "interior",
    kind: "questions",
    icon: MicroscopeIcon,
    title: "Evaluación Interior",
    description:
      "Características de la pulpa, la piel, el sabor y la experiencia de consumo.",
    questions: EVALS_INTERIOR,
  },
  {
    id: "brix",
    kind: "brix",
    icon: PipetteIcon,
    title: "Brix",
    description: "Diez lecturas de refractómetro por corte.",
  },
  {
    id: "criba",
    kind: "criba",
    icon: Grid3x3Icon,
    title: "Criba",
    description: "Peso de la muestra por calibre, del 8 al 16.",
  },
  {
    id: "rendimiento",
    kind: "rendimiento",
    icon: GaugeCircleIcon,
    title: "Rendimiento",
    description: "Kilogramos y racimos cosechados en cada corte.",
  },
  {
    id: "comentarios",
    kind: "comentarios",
    icon: MessageSquareTextIcon,
    title: "Comentarios y observaciones",
    description: "Notas del evaluador sobre la fruta y sobre la evaluación.",
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

  // Lo único que la pantalla sabe de las fotografías: quién es su dueño. Lo
  // demás —leerlas, capturarlas y abrir la cuadrícula— vive en
  // `EvalPhotosForm`, que es la sección que las muestra.
  const claimFor = usePhotosStore((state) => state.claimFor);

  // `setParams` cambia de hermano sin desmontar la pantalla, así que sin esto
  // las respuestas del tratamiento anterior seguirían aquí.
  //
  // Compara contra el id anterior en vez de limpiar en cada efecto: tal cual
  // estaba, cualquier remonte borraba lo ya contestado. Las fotos no se tocan
  // aquí — de eso se encarga `claimFor`, que sí sabe de quién son.
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

  // En cada montaje y en cada cambio de id, pero el vaciado lo decide el
  // store: solo si lo guardado era de otro tratamiento.
  useEffect(() => {
    claimFor(id);
  }, [id, claimFor]);

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

type EvaluationSectionsProps = {
  tratamientoId: string;
  /** El hueco que hay que reservar para el bloque superpuesto de la cabecera. */
  reservedHeight: number;
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
function EvaluationSections({
  tratamientoId,
  reservedHeight,
  onScroll,
}: EvaluationSectionsProps) {
  // El `open` vive aquí y no en la sección: cabecera y cuerpo son hijos
  // sueltos del scroll —lo exige `stickyHeaderIndices`— y no hay un envoltorio
  // común donde compartirlo. Ausente es abierta.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = useCallback((sectionId: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
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

      toggleSection(sectionId);
    },
    [scrollOffset, scrollRef, toggleSection],
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
              sección al doble de distancia que las demás. */}
        <View style={{ height: reservedHeight }} />
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
                summary={sectionSummary(section)}
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
