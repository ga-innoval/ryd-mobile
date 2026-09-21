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
 *
 * Sin `overflow-hidden`: el único con contenido que llegue al borde es el
 * resumen, y ese recorta por dentro, al radio interior.
 */
const SLOT_CN = "w-20 h-20 rounded-xl border border-border bg-secondary";

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
  /** Abrir la cuadrícula con todo lo capturado. */
  onOpenPhotos: () => void;
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
export function EvalPhotos({
  photos,
  onCapture,
  onOpenPhotos,
}: EvalPhotosProps) {
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
          // El cuadrado es la puerta a la cuadrícula, así que es un
          // `Pressable` y no un `View` agrupado a mano: el rol y el foco los
          // trae él. Quién navega es la pantalla; aquí solo se avisa.
          <Pressable
            className={cn(SLOT_CN, "active:scale-95")}
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
