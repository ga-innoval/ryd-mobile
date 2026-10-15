import { Pressable, View } from "react-native";
import Toast, { type ToastConfig } from "react-native-toast-message";
import {
  CheckCircle2Icon,
  CircleXIcon,
  InfoIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  alertDescriptionColorVariants,
  alertIconVariants,
  alertTextVariants,
  alertVariants,
  type AlertVariant,
} from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type ToastBodyProps = {
  icon: LucideIcon;
  /** La misma que usan los avisos del formulario: de ahí salen el fondo, el
   *  borde y el color del texto. */
  variant: AlertVariant;
  title?: string;
  description?: string;
  onClose: () => void;
  /** Hace tocable todo el cuerpo. Sin él, solo se cierra con la equis. */
  onPress?: () => void;
};

/**
 * El cuerpo de una notificación.
 *
 * **Se pinta con las variantes de `alert.tsx`, no con una copia suya.** Las dos
 * cosas dicen lo mismo —esto va mal, esto es raro, esto salió bien— y con dos
 * juegos de clases acababan diciéndolo con dos rojos distintos. Lo que cambia es
 * la disposición, no el color: el aviso vive dentro de una tarjeta del
 * formulario y ocupa su ancho, y este flota sobre la pantalla, así que se queda
 * con su ancho máximo, su sombra y su fila de icono, texto y cerrar.
 *
 * Por eso el icono va como hermano en la fila y no absoluto a la izquierda como
 * en el aviso, y por eso el cuerpo toma solo el **color** de la descripción
 * (`alertDescriptionColorVariants`) y no su sangrado: aquí no hay bajo qué
 * sangrar.
 */
export function ToastBody({
  icon,
  variant,
  title,
  description,
  onClose,
  onPress,
}: ToastBodyProps) {
  return (
    <Pressable
      // Sin `onPress` no es un botón: que `Pressable` no se anuncie como tal
      // ni se deje tocar en vano.
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      className={cn(
        alertVariants({ variant }),
        // `w-auto` deshace el `w-full` del aviso, que ahí ocupa el ancho de su
        // tarjeta: una notificación corta tiene que seguir midiendo lo que mide
        // su texto en vez de estirarse hasta el tope.
        "mx-4 w-auto max-w-md flex-row items-center gap-3 self-end rounded-xl px-3 py-3 shadow-md shadow-black/20 sm:min-w-toast sm:max-w-xl",
      )}
    >
      <Icon
        strokeWidth={2.4}
        as={icon}
        size={16}
        className={cn(alertIconVariants({ variant }), "px-3")}
      />

      {/* `shrink` es lo que hace que el texto envuelva en vez de desbordar
          la fila cuando el mensaje es largo. */}
      <View className="shrink">
        {title && (
          <Text className={cn(alertTextVariants({ variant }), "leading-5")}>
            {title}
          </Text>
        )}
        {description && (
          <Text
            className={cn(
              alertDescriptionColorVariants({ variant }),
              "text-sm leading-5",
            )}
          >
            {description}
          </Text>
        )}
      </View>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Cerrar notificación"
        className="ml-auto"
      >
        <Icon
          as={XIcon}
          size={16}
          className={cn(alertDescriptionColorVariants({ variant }), "px-3")}
        />
      </Pressable>
    </Pressable>
  );
}

/**
 * Cada tipo de notificación con la variante de aviso que le corresponde.
 *
 * `info` va en `default` —la tarjeta neutra— y no en ámbar como antes: el ámbar
 * es el color de «este dato se sale de lo habitual», y «hay actualizaciones por
 * descargar» no es eso. Es el único cambio de color que trae esta alineación.
 */
/** El `onPress` de la librería, solo si quien mostró el toast lo pidió: por sí
 *  sola siempre trae una función vacía. Ver `lib/toast.ts`. */
const pressOf = ({
  props,
  onPress,
}: {
  props?: { tappable?: boolean };
  onPress: () => void;
}) => (props?.tappable ? onPress : undefined);

const toastConfig: ToastConfig = {
  success: ({ text1, text2, hide, ...rest }) => (
    <ToastBody
      icon={CheckCircle2Icon}
      variant="success"
      title={text1}
      description={text2}
      onClose={() => hide()}
      onPress={pressOf(rest)}
    />
  ),
  error: ({ text1, text2, hide, ...rest }) => (
    <ToastBody
      icon={CircleXIcon}
      variant="destructive"
      title={text1}
      description={text2}
      onClose={() => hide()}
      onPress={pressOf(rest)}
    />
  ),
  info: ({ text1, text2, hide, ...rest }) => (
    <ToastBody
      icon={InfoIcon}
      variant="warning"
      title={text1}
      description={text2}
      onClose={() => hide()}
      onPress={pressOf(rest)}
    />
  ),
};

export function Toaster() {
  return <Toast position="bottom" config={toastConfig} />;
}
