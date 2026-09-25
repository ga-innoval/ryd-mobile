import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Platform, TextInput } from "react-native";

const inputVariants = cva(
  "flex h-12 w-full min-w-0 flex-row items-center rounded-xl border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground dark:bg-input/30",
        /** Un dato fuera de lo habitual que igualmente cuenta: el rango de
         *  Brix, el peso de muestra que no cuadra. */
        warn: "border-warn/20 bg-warn-background text-warn",
        /** Un dato que no puede ser cierto: el promedio por baya mayor que su
         *  calibre, los kilogramos con el conteo en cero. */
        destructive:
          "border-destructive/20 bg-destructive-background text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type InputVariant = NonNullable<VariantProps<typeof inputVariants>["variant"]>;

/**
 * El cursor y la selección no salen del `className`: son props del `TextInput`,
 * no estilos. Los hex son los mismos tokens de `tailwind.config.js` —`warn` y
 * `destructive`—; si cambian allí, cambian aquí.
 *
 * `cursorColor` es de Android; en iOS el cursor lo tiñe `selectionColor`, así
 * que las dos variantes marcadas ponen los dos. La `default` deja el
 * `cursorColor` al sistema, como estaba.
 */
const CARET: Record<InputVariant, { cursor?: string; selection: string }> = {
  default: { selection: "rgba(45,90,39,0.4)" },
  warn: { cursor: "#B96419", selection: "rgba(185,100,25,0.4)" },
  destructive: { cursor: "#8A1E12", selection: "rgba(138,30,18,0.4)" },
};

type InputProps = React.ComponentProps<typeof TextInput> &
  React.RefAttributes<TextInput> & {
    variant?: InputVariant;
  };

/**
 * El campo de texto de la app.
 *
 * Las variantes viven aquí y no en cada formulario porque Brix, Criba y
 * Rendimiento marcan sus campos igual: con las clases escritas en cada
 * componente, cambiar el ámbar obligaba a tocar los tres y se descolgaba el que
 * se olvidara.
 */
function Input({ className, variant = "default", ...props }: InputProps) {
  const caret = CARET[variant];

  return (
    <TextInput
      cursorColor={caret.cursor}
      selectionColor={caret.selection}
      className={cn(
        inputVariants({ variant }),
        props.editable === false &&
          cn(
            "opacity-50",
            Platform.select({
              web: "disabled:pointer-events-none disabled:cursor-not-allowed",
            }),
          ),
        Platform.select({
          web: cn(
            "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          ),
          native: "placeholder:text-muted-foreground/50",
        }),
        className,
      )}
      {...props}
    />
  );
}

export { Input, type InputVariant };
