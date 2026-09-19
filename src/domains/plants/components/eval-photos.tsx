import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { CameraIcon, ImagesIcon, type LucideIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { buildPhotoSummary } from "../lib/build-photo-summary";
import type { PhotoSource } from "../types";

/**
 * Medida fija en vez de derivada del ancho de la fila: el cuadro ya no crece
 * con la tablet, pero tampoco depende de cuántos huecos haya ni del padding que
 * le deje la tarjeta.
 */
const SLOT_CN =
  "w-20 h-20 overflow-hidden rounded-xl border border-border bg-secondary";

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

type EvalPhotosProps = {
  photos: string[];
  /** Puede no añadir nada: cancelar el picker es el caso normal. */
  onCapture: (source: PhotoSource) => void;
};

/**
 * Tira de fotografías de evidencia de una sección de la encuesta.
 *
 * Presentacional: recibe las URIs ya capturadas y avisa del origen que se ha
 * pedido. Quién abre la cámara o la galería y dónde se guarda lo capturado es
 * decisión de quien lo monta, igual que en `EvalQuestionsForm` con las
 * respuestas.
 *
 * Qué enseña el cuadrado del resumen vive en `buildPhotoSummary`, que es lo que
 * tiene test: la última foto y el total son una regla de negocio, no una
 * cuestión de pintado.
 */
export function EvalPhotos({ photos, onCapture }: EvalPhotosProps) {
  const summary = buildPhotoSummary(photos);

  return (
    <View className="gap-2">
      {/* Mismo tratamiento que la etiqueta de una pregunta, para que el bloque
          se lea como uno más del formulario. */}
      <Text variant="muted" className="text-base">
        Fotografías
      </Text>

      <View className="flex-row gap-2">
        {summary && (
          // Agrupado para accesibilidad: un "13" suelto no dice nada, y el
          // desenfoque de debajo no es descriptible.
          <View
            className={SLOT_CN}
            accessible
            accessibilityLabel={
              summary.total === 1
                ? "1 fotografía adjunta"
                : `${summary.total} fotografías adjuntas`
            }
          >
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
            <View className="absolute inset-0 items-center justify-center bg-foreground/70">
              <Text className="text-xl font-semibold text-primary-foreground">
                {summary.total}
              </Text>
            </View>
          </View>
        )}

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
