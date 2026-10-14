import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/**
 * Una escala numérica que se llena hasta donde se toca: al elegir el 4, el 1, el
 * 2 y el 3 quedan marcados con él.
 *
 * **Componente aparte y no una variante de `OptionPicker`**, aunque se parezcan:
 * allí las opciones son excluyentes —«Nula» o «Media», nunca las dos— y aquí el
 * valor es una altura, así que lo marcado es todo lo que queda por debajo. Con
 * una variante, la mitad del componente tendría que preguntarse cuál de los dos
 * comportamientos le toca.
 *
 * **Lo marcado por debajo es pintura, no selección.** Para quien no ve la
 * pantalla esto sigue siendo elegir uno entre cinco, así que solo el elegido va
 * como `checked`: anunciar cuatro opciones marcadas describiría un control que
 * no existe.
 */
export function RatingPicker({
  label,
  value,
  max = 5,
  onChange,
}: {
  label: string;
  value?: number;
  /** Cuántos peldaños tiene la escala. */
  max?: number;
  /** Llega `undefined` al pulsar el peldaño ya elegido, que lo deselecciona. */
  onChange: (value: number | undefined) => void;
}) {
  const grados = Array.from({ length: max }, (_, index) => index + 1);

  return (
    <View className="gap-2">
      <Text variant="muted" className="text-base">
        {label}
      </Text>

      {/* El canal horizontal lo dan el `px-1` de cada celda y el `-mx-1` de
          aquí, que lo cancela en los extremos para que el primer peldaño siga a
          ras de la etiqueta — igual que en `OptionPicker`. */}
      <View
        role="radiogroup"
        aria-label={label}
        className="-mx-1 flex-row flex-wrap gap-y-2"
      >
        {grados.map((grado) => {
          const lleno = value !== undefined && grado <= value;

          return (
            <View key={grado} className="px-1">
              <Pressable
                role="radio"
                aria-checked={grado === value}
                aria-label={`${grado} de ${max}`}
                // Pulsar el elegido lo deselecciona, como en `OptionPicker`: la
                // escala es opcional y sin esto no habría forma de dejarla sin
                // contestar después de haberla tocado.
                onPress={() => onChange(grado === value ? undefined : grado)}
                className={cn(
                  // `min-w-16` es el mínimo cómodo de tocar con guantes. Sin
                  // repartir la fila: cinco dígitos estirados a un quinto de una
                  // tablet serían cinco botones enormes con un número diminuto.
                  "min-w-16 items-center justify-center rounded-xl border px-2 py-2",
                  // El encogido con `active:` y no con `usePressScale`, por lo
                  // mismo que en `OptionPicker`: un formulario monta decenas de
                  // estos y un shared value por cada uno se nota al abrir la
                  // sección.
                  "active:scale-95",
                  lleno ? "bg-foreground/90 border-primary" : "border-border",
                )}
              >
                <Text
                  className={cn(
                    "font-medium",
                    lleno && "text-primary-foreground",
                  )}
                >
                  {grado}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
