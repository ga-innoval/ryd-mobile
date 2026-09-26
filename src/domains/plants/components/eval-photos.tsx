import { useCallback, useMemo } from "react";
import { Pressable, View } from "react-native";
import { useAppRouter } from "@/lib/use-app-router";
import { Image } from "expo-image";
import { CameraIcon, ImagesIcon, type LucideIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { buildPhotoSummary } from "../lib/build-photo-summary";
import {
  PHOTO_CATEGORIES,
  summarizePhotoCategories,
} from "../lib/photo-categories";
import { usePhotoCapture } from "../hooks/use-photo-capture";
import {
  EMPTY_FOTOS,
  useAddFotos,
  useFotos,
  type Foto,
} from "../hooks/use-respuesta-fotos";
import { groupFotosByCategoria } from "../lib/group-fotos-by-categoria";
import type { PhotoSource } from "../types";

/**
 * Lo que comparten los huecos de la fila. Medida fija en vez de derivada del
 * ancho: no depende de cuántos haya ni del padding que le deje la tarjeta.
 *
 * Sin `overflow-hidden`: el único con contenido que llegue al borde es el
 * resumen, y ese recorta por dentro, al radio interior.
 */
const SLOT_CN = "rounded-xl border border-border bg-secondary";

/** El resumen es más grande que los botones a propósito: es lo que hay que ver
 *  de un vistazo —cuántas llevas— y la puerta a la cuadrícula. */
const SUMMARY_SLOT_CN = "w-20 h-20";
const CAPTURE_SLOT_CN = "w-14 h-14";

/**
 * La fila reserva de entrada el alto del resumen —el hueco más alto que puede
 * contener— para que no crezca al adjuntar la primera fotografía: sin esto pasa
 * de los 56 de los botones a los 80 del cuadrado, y el salto se ve.
 *
 * Si cambia `SUMMARY_SLOT_CN`, cambia con él. Es `min-h` y no alto fijo para
 * que un nombre que envuelva a dos líneas empuje en vez de salirse.
 */
const ROW_CN = "min-h-20";

/** Ancho mínimo del nombre, para que el resumen empiece en el mismo punto en
 *  las tres filas: «Corte horizontal» es bastante más largo que «Racimo». */
const LABEL_CN = "min-w-[160px]";

const SUMMARY_BLUR = 2;

/**
 * Un botón por origen, en vez de uno que pregunte. En campo se capturan muchas
 * fotos seguidas, y un diálogo intermedio es un toque de más en cada una.
 *
 * Fuera del componente porque es una constante, no algo que dependa de las
 * props: así no se reconstruye en cada render.
 */
const CAPTURE_BUTTONS: {
  source: PhotoSource;
  icon: LucideIcon;
  label: string;
}[] = [
  { source: "library", icon: ImagesIcon, label: "Elegir de galería" },
  { source: "camera", icon: CameraIcon, label: "Tomar foto" },
];

function photosLabel(count: number): string {
  if (count === 0) return "Sin fotografías";

  return count === 1 ? "1 fotografía" : `${count} fotografías`;
}

/**
 * Lo que la cabecera de la sección muestra en lugar de la barra de progreso:
 * cuántas tomas llevan alguna fotografía y cuántas hay en total.
 *
 * Sin barra de avance a propósito: ninguna categoría es obligatoria, y una
 * barra diría que hay que llenar las tres.
 */
export function PhotosHeaderSummary({
  tratamientoId,
}: {
  tratamientoId: string;
}) {
  const { data: fotos } = useFotos(tratamientoId);
  const { total, withPhotos } = summarizePhotoCategories(
    groupFotosByCategoria(fotos ?? EMPTY_FOTOS),
  );

  return (
    <View className="flex-row items-baseline justify-between gap-4">
      {/* Siempre, también en cero: el hueco vacío no decía cuántas tomas hay. */}
      <Text variant="muted">
        {`${withPhotos} de ${PHOTO_CATEGORIES.length} categorías`}
      </Text>
      <View className="flex-row items-baseline gap-2">
        <Text variant="muted">Adjuntas</Text>
        <Text
          className={cn(
            "text-xl font-bold",
            total === 0 && "text-muted-foreground",
          )}
        >
          {total}
        </Text>
      </View>
    </View>
  );
}

/**
 * La sección de fotografías: una tira por cada toma del catálogo.
 *
 * Es el componente "inteligente" de las fotos —lee el store, abre la cámara y
 * lleva a la cuadrícula—, y por eso la pantalla solo tiene que montarlo. Antes
 * eso vivía allí porque la tira colgaba de las secciones de preguntas; ahora
 * las fotos son una sección entera y ya no hay razón para que la pantalla sepa
 * de ellas. Lo único suyo que le queda es `claimFor`, que las vacía al cambiar
 * de tratamiento.
 */
export function EvalPhotosForm({ tratamientoId }: { tratamientoId: string }) {
  const router = useAppRouter();
  const { data: fotos } = useFotos(tratamientoId);
  const porCategoria = useMemo(
    () => groupFotosByCategoria(fotos ?? EMPTY_FOTOS),
    [fotos],
  );
  const { mutate: addFotos } = useAddFotos(tratamientoId);
  const capturePhoto = usePhotoCapture();

  // Llegan varias de golpe cuando se eligen de la galería, y ninguna al
  // cancelar o quedarse sin permiso — que es el caso normal, no un error.
  //
  // Guardar es copiar el archivo y escribir su fila, y ocurre aquí mismo: la
  // foto queda a salvo en cuanto se toma, sin esperar al guardado del
  // formulario. Lo que devuelve el picker vive en la caché del sistema, que
  // puede purgarse.
  const handleCapture = useCallback(
    async (categoria: string, source: PhotoSource) => {
      const uris = await capturePhoto(source);
      if (uris.length === 0) return;

      addFotos({ categoria, uris });
    },
    [capturePhoto, addFotos],
  );

  return (
    <View>
      {PHOTO_CATEGORIES.map((category, index) => (
        <View key={category.id}>
          {/* Una línea entre tomas, con su aire a los dos lados. Cada toma es
              ahora una fila de ancho completo —nombre a la izquierda, huecos a
              la derecha—, así que sin la línea las tres se leerían como una
              lista pegada. */}
          {index > 0 && <Separator className="my-3" />}
          <EvalPhotos
            label={category.label}
            photos={porCategoria[category.id] ?? EMPTY_FOTOS}
            onCapture={(source) => handleCapture(category.id, source)}
            onOpenPhotos={() =>
              // La cuadrícula consulta por su cuenta, así que necesita saber de
              // qué tratamiento son: antes le bastaba la categoría porque el
              // store era implícitamente el del tratamiento abierto.
              router.push({
                pathname: "/photos",
                params: { categoryId: category.id, tratamientoId },
              })
            }
          />
        </View>
      ))}
    </View>
  );
}

type EvalPhotosProps = {
  /** La toma de la que son estas fotografías: «Racimo», «Corte vertical»… */
  label: string;
  photos: readonly Foto[];
  /** Puede no añadir nada: cancelar el picker es el caso normal. */
  onCapture: (source: PhotoSource) => void;
  /** Abrir la cuadrícula con todo lo capturado. */
  onOpenPhotos: () => void;
};

/**
 * La fila de fotografías de evidencia de una categoría: de qué toma es y qué
 * lleva capturado a la izquierda, y los huecos a la derecha.
 *
 * Presentacional: recibe las URIs ya capturadas y avisa del origen que se ha
 * pedido. Quién abre la cámara o la galería y dónde se guarda lo capturado es
 * decisión de quien lo monta —`EvalPhotosForm`—, igual que en
 * `EvalQuestionsForm` con las respuestas.
 *
 * Qué enseña el cuadrado del resumen vive en `buildPhotoSummary`, que es lo que
 * tiene test: la última foto y el total son una regla de negocio, no una
 * cuestión de pintado.
 */
export function EvalPhotos({
  label,
  photos,
  onCapture,
  onOpenPhotos,
}: EvalPhotosProps) {
  const summary = buildPhotoSummary(photos);

  return (
    <View className={cn("flex-row items-center gap-4", ROW_CN)}>
      <View className={cn(LABEL_CN, "gap-0.5")}>
        <Text className="font-medium">{label}</Text>
        {/* Cuántas lleva, en texto: el cuadrado del resumen lo dice con un
            número, pero solo aparece cuando hay alguna, y «Sin fotografías» es
            lo que distingue una toma pendiente de una que no toca. */}
        <Text variant="muted">{photosLabel(photos.length)}</Text>
      </View>

      {summary && (
        // El cuadrado es la puerta a la cuadrícula, así que es un `Pressable`
        // y no un `View` agrupado a mano: el rol y el foco los trae él. Quién
        // navega es la pantalla; aquí solo se avisa.
        //
        // Va junto al nombre y no con los botones: lo que lleva capturado la
        // toma se lee con su nombre, y capturar es lo que se hace al otro lado
        // de la fila.
        <Pressable
          className={cn(SLOT_CN, SUMMARY_SLOT_CN, "active:scale-95")}
          onPress={onOpenPhotos}
          role="button"
          aria-label={
            summary.total === 1
              ? "Ver la fotografía adjunta"
              : `Ver las ${summary.total} fotografías adjuntas`
          }
        >
          {/* Foto y velo se recortan al radio interior del borde —11:
                `rounded-xl` (12) menos `border` (1)—. Recortados al de fuera,
                sus esquinas rectas se metían en la franja curva del borde
                translúcido y la teñían. */}
          <View className="flex-1 overflow-hidden rounded-[11px]">
            <Image
              source={summary.uri}
              contentFit="cover"
              blurRadius={SUMMARY_BLUR}
              transition={150}
              className="flex-1"
            />
            {/* El velo va sobre la imagen y no es un `opacity` de ella: hay que
                oscurecer para que el número contraste, no transparentar la foto
                contra el fondo de la tarjeta. */}
            <View className="absolute inset-0 items-center justify-center bg-foreground/80">
              <Text className="text-xl font-semibold text-primary-foreground">
                {summary.total}
              </Text>
            </View>
          </View>
        </Pressable>
      )}

      {/* Los botones se van al borde derecho con el `ml-auto`, así que el hueco
          libre de la fila queda entre el resumen y ellos, y no todo al final. */}
      <View className="ml-auto flex-row gap-2">
        {CAPTURE_BUTTONS.map(({ source, icon, label }) => (
          <Pressable
            key={source}
            onPress={() => onCapture(source)}
            role="button"
            aria-label={label}
            // `active:` y no `usePressScale`: es el mismo encogido que las
            // píldoras de `option-picker.tsx`, y ahí está medido por qué dentro
            // de este formulario no conviene un shared value más.
            className={cn(
              SLOT_CN,
              CAPTURE_SLOT_CN,
              "items-center justify-center active:scale-95",
            )}
          >
            <Icon as={icon} size={24} className="text-primary" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
