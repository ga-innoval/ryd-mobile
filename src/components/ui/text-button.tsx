import { Pressable, type PressableProps } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import {
  PILL_CONTENT_CN,
  pillVariants,
  type PillVariant,
} from "@/components/ui/icon-button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type TextButtonProps = Omit<PressableProps, "children"> & {
  children: string;
  variant?: PillVariant;
  /**
   * Un icono a la izquierda del texto, del color de la variante. Para acciones
   * que se reconocen antes por el dibujo que por la palabra, como descartar.
   */
  icon?: LucideIcon;
};

/**
 * El mismo pill que `IconButton` pero con texto: comparten variantes y clase
 * base, así que cualquier ajuste mueve a los dos. Solo cambia el dimensionado
 * —alto fijo y padding lateral en vez de cuadrado—, porque el texto no puede
 * vivir en una caja de ancho fijo.
 *
 * El hijo es una cadena y no un nodo: el `Text` lo pone el propio botón, y así
 * el tamaño y el color son siempre los del control y no los de quien lo use.
 */
export function TextButton({
  className,
  disabled,
  variant = "default",
  icon,
  children,
  ...props
}: TextButtonProps) {
  return (
    <Pressable
      className={cn(
        "h-8 gap-2 px-3",
        pillVariants({ variant }),
        disabled ? "opacity-50" : "opacity-100",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {icon && (
        <Icon as={icon} size={16} className={PILL_CONTENT_CN[variant]} />
      )}
      <Text className={cn("text-sm font-medium", PILL_CONTENT_CN[variant])}>
        {children}
      </Text>
    </Pressable>
  );
}
