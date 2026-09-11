import * as ToggleGroupPrimitive from "@rn-primitives/toggle-group";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { usePressScale } from "@/lib/use-press-scale";
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
 * El `View` exterior es el hijo flex —lleva `grow basis-24`— y el
 * `Animated.View` solo la escala. Separarlos es lo que permite encoger la
 * píldora sin que la animación se coma su participación en el reparto de la
 * fila, que es lo que pasaría poniendo ambas cosas en el mismo elemento.
 *
 * Es un componente y no parte del `.map()` porque cada opción necesita su
 * propio shared value, y los hooks no pueden ir en un bucle.
 */
function Option<T extends string>({
  option,
  isSelected,
}: {
  option: PickerOption<T>;
  isSelected: boolean;
}) {
  const scale = usePressScale();

  return (
    <View className="grow basis-24">
      <Animated.View style={scale.animatedStyle}>
        <ToggleGroupPrimitive.Item
          value={option.value}
          onPressIn={scale.onPressIn}
          onPressOut={scale.onPressOut}
          className={cn(
            "w-full items-center justify-center rounded-xl border px-3 py-3",
            isSelected ? "bg-foreground/90 border-primary" : "border-border",
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
      </Animated.View>
    </View>
  );
}

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

      {/* `grow basis-24` es lo que hace que se ajuste solo: cada opción pide
          96px, crece para repartirse el ancho sobrante de su fila, y cuando no
          cabe salta a la siguiente. Por eso el mismo componente da varias por
          fila en un contenedor ancho y una sola en una columna estrecha, sin
          configurar nada por pregunta. */}
      <ToggleGroupPrimitive.Root
        type="single"
        value={value}
        onValueChange={(next) => onChange(next as T | undefined)}
        className="flex-row flex-wrap gap-2"
      >
        {options.map((option) => (
          <Option
            key={option.value}
            option={option}
            isSelected={ToggleGroupPrimitive.utils.getIsSelected(
              value,
              option.value,
            )}
          />
        ))}
      </ToggleGroupPrimitive.Root>
    </View>
  );
}
