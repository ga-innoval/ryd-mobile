import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";

/**
 * El pill de las cabeceras y las barras de acción.
 *
 * Se exporta porque `TextButton` es este mismo control con texto en vez de
 * icono: con las clases duplicadas, dos botones equivalentes acabarían
 * viéndose distinto en cuanto alguien retocara uno.
 */
export const pillVariants = cva(
  "flex-row items-center justify-center rounded-full border",
  {
    variants: {
      variant: {
        /** Sobre `bg-primary`: el header verde. */
        default: "bg-primary-foreground/15 border-primary-foreground/30",
        /**
         * Sobre superficies claras (`bg-card`, `bg-background`), donde el pill
         * translúcido blanco desaparece.
         *
         * `bg-secondary` y no un gris: es el mismo verde claro de las cabeceras
         * de sección y de los huecos de la tira, así que el botón se lee como
         * parte de la app.
         */
        onLight: "bg-secondary border-border",
        /**
         * El paso de confirmar algo que borra, como el segundo toque de
         * «Descartar corte».
         *
         */
        destructive: "bg-destructive-background border-destructive/30",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type PillVariant = NonNullable<
  VariantProps<typeof pillVariants>["variant"]
>;

/**
 * Color del contenido de cada variante.
 *
 * Viaja por `TextClassContext`, que es de donde `Icon` y `Text` lo toman, así
 * que quien use el botón no tiene que repetirlo en cada hijo. Un `className`
 * explícito en el hijo sigue ganando.
 */
export const PILL_CONTENT_CN: Record<PillVariant, string> = {
  default: "text-primary-foreground",
  onLight: "text-foreground",
  destructive: "text-destructive",
};

type IconButtonProps = Omit<PressableProps, "children"> & {
  children?: ReactNode;
  variant?: PillVariant;
};

export function IconButton({
  className,
  disabled,
  variant = "default",
  children,
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      className={cn(
        "size-8",
        pillVariants({ variant }),
        disabled ? "opacity-50" : "opacity-100",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      <TextClassContext.Provider value={PILL_CONTENT_CN[variant]}>
        {children}
      </TextClassContext.Provider>
    </Pressable>
  );
}
