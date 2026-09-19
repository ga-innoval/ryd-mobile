import { Pressable, type PressableProps } from "react-native";
import {
  PILL_CONTENT_CN,
  pillVariants,
  type PillVariant,
} from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type TextButtonProps = Omit<PressableProps, "children"> & {
  children: string;
  variant?: PillVariant;
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
  children,
  ...props
}: TextButtonProps) {
  return (
    <Pressable
      className={cn(
        "h-8 px-3",
        pillVariants({ variant }),
        disabled ? "opacity-50" : "opacity-100",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      <Text className={cn("text-sm font-medium", PILL_CONTENT_CN[variant])}>
        {children}
      </Text>
    </Pressable>
  );
}
