import { Platform, TextInput } from "react-native";
import { cn } from "@/lib/utils";

/**
 * El `Input` de la app en varias líneas, para notas.
 *
 * Es el `Textarea` de react-native-reusables —un `TextInput` con `multiline`,
 * sin primitivo detrás— con las clases del `Input` de aquí, para que los dos
 * campos se lean como el mismo control.
 *
 * **Alto mínimo y no alto fijo**: la caja crece con lo que se escribe en vez de
 * hacer scroll dentro de sí misma, que en una tablet obliga a arrastrar con el
 * dedo dentro de un recuadro para releer una nota de cuatro líneas.
 */
function Textarea({
  className,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      multiline
      // Sin esto, Android centra el texto verticalmente mientras la caja está
      // casi vacía y lo sube en cuanto crece.
      textAlignVertical="top"
      selectionColor={"rgba(45,90,39,0.4)"}
      className={cn(
        "dark:bg-input/30 border-border bg-background text-foreground min-h-[120px] w-full rounded-xl border px-3 py-3 text-base leading-6 shadow-sm shadow-black/5",
        props.editable === false &&
          cn(
            "opacity-50",
            Platform.select({
              web: "disabled:pointer-events-none disabled:cursor-not-allowed",
            }),
          ),
        Platform.select({
          web: cn(
            "placeholder:text-muted-foreground outline-none transition-[color,box-shadow] md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          ),
          native: "placeholder:text-muted-foreground/50",
        }),
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
