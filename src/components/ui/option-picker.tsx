import * as ToggleGroupPrimitive from "@rn-primitives/toggle-group";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export type PickerOption<T extends string> = {
  label: string;
  value: T;
};

type OptionPickerProps<T extends string> = {
  label: string;
  options: PickerOption<T>[];
  value?: T;
  /** Llega `undefined` al pulsar la opción ya activa, que la deselecciona. */
  onChange: (value: T | undefined) => void;
};

// TODO(obligatorias): cuando se sepa qué preguntas son obligatorias, un prop
// `required` debe ignorar ese `undefined` para que no se puedan dejar vacías.
// Conviene que además estreche la firma de `onChange`, para que quien consuma
// una obligatoria no tenga que comprobar el `undefined`.

/**
 * Selector de una opción entre varias, con su etiqueta.
 *
 * Se apoya en `@rn-primitives/toggle-group` y no en el `ToggleGroup` de RNR
 * porque aquel está diseñado como *segmented control*: botones unidos,
 * `rounded-none` y `border-l-0` con los extremos redondeados. Aquí las píldoras
 * van sueltas y saltan de línea, así que usarlo obligaría a pasar media docena
 * de clases solo para deshacer ese aspecto. Del primitivo viene lo que de
 * verdad importa —la máquina de selección y la accesibilidad—; el estilo es
 * nuestro, igual que hace `select.tsx` con el suyo.
 *
 * **El encogido al pulsar va con `active:` y no con `usePressScale`**, que es
 * lo que usa el resto de la app. Está medido: un formulario monta más de 50
 * opciones a la vez, y un shared value más un animated style por opción eran
 * un centenar de objetos de Reanimated creados en el mismo commit — segundos
 * de espera al desplegar una sección por primera vez. Con `active:` el
 * encogido lo resuelve el estado de press del propio `Pressable`, sin crear
 * nada. Se pierde el suavizado de `usePressScale`: aquí es un salto. Ese hook
 * sigue siendo lo correcto donde los pressables se cuentan con los dedos, como
 * en las tarjetas de la lista.
 */
export function OptionPicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: OptionPickerProps<T>) {
  return (
    <View className="gap-2">
      <Text variant="muted" className="text-base">
        {label}
      </Text>

      {/* Tope de 4 opciones por fila; a partir de ahí saltan a la siguiente y
          la sobrante se queda del ancho de una celda, sin estirarse.
          
          El canal horizontal NO puede venir de `gap`: cuatro celdas del 25% más
          tres huecos suman más del 100% y solo entrarían tres. Lo dan el `px-1`
          de cada celda y el `-mx-1` de aquí, que lo cancela en los extremos
          para que la primera opción siga a ras de la etiqueta. El vertical sí
          es `gap-y-2`, que ahí no compite con nada. */}
      <ToggleGroupPrimitive.Root
        type="single"
        value={value}
        onValueChange={(next) => onChange(next as T | undefined)}
        className="flex-row flex-wrap gap-y-2 -mx-1"
      >
        {options.map((option) => {
          const isSelected = ToggleGroupPrimitive.utils.getIsSelected(
            value,
            option.value,
          );

          return (
            // El `View` exterior es el hijo flex y lleva el reparto de ancho;
            // la escala va en el `Item`, que al ser un transform no participa
            // en el layout y no le quita sitio a la píldora en su fila.
            //
            // El `min-w-24` es el tope de 4 visto por abajo: en un contenedor
            // estrecho —una pregunta a media fila— el 25% sería diminuto, así
            // que entra el mínimo y caben menos. Cuatro es un máximo, no una
            // obligación.
            <View key={option.value} className="w-1/4 px-1 min-w-24">
              <ToggleGroupPrimitive.Item
                value={option.value}
                className={cn(
                  "w-full items-center justify-center rounded-xl border px-2 py-2",
                  "active:scale-95",
                  isSelected
                    ? "bg-foreground/90 border-primary"
                    : "border-border",
                )}
              >
                <Text
                  className={cn(
                    "font-medium",
                    isSelected && "text-primary-foreground",
                  )}
                >
                  {option.label}
                </Text>
              </ToggleGroupPrimitive.Item>
            </View>
          );
        })}
      </ToggleGroupPrimitive.Root>
    </View>
  );
}
