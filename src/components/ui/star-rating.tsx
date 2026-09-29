import { Pressable, View } from "react-native";
import { StarIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

const VALUES = [1, 2, 3, 4, 5] as const;

type StarRatingProps = {
  label: string;
  /** `undefined` es sin contestar, que no es lo mismo que 1. */
  value?: number;
  /** Llega `undefined` al pulsar la estrella ya elegida, que la deselecciona. */
  onChange: (value: number | undefined) => void;
  /** Qué significan los extremos: «1 — Duro · 5 — Blando». */
  minLabel: string;
  maxLabel: string;
};

/**
 * Una escala de 1 a 5, en estrellas.
 *
 * **Se rellenan hasta la tocada**, no solo esa: es lo que hace que la escala se
 * lea como una cantidad y no como cinco opciones sueltas.
 *
 * **Tocar la estrella ya elegida deja la pregunta sin contestar.** Ninguna es
 * obligatoria y es la única forma de deshacer una respuesta, igual que en
 * `OptionPicker`.
 *
 * **En verde y no en ámbar**: aquí el ámbar es el color de los avisos, así que
 * una estrella ámbar se leería como que algo anda mal con el dato en vez de como
 * una puntuación.
 *
 * Bespoke y no de RNR porque no hay ningún primitivo de esto —es el mismo caso
 * que `option-picker` y `pressable-scale`—.
 */
export function StarRating({
  label,
  value,
  onChange,
  minLabel,
  maxLabel,
}: StarRatingProps) {
  return (
    <View className="gap-2">
      <Text variant="muted">{label}</Text>

      <View role="group" aria-label={label} className="flex-row gap-2">
        {VALUES.map((star) => {
          const filled = value !== undefined && value >= star;

          return (
            <Pressable
              key={star}
              onPress={() => onChange(value === star ? undefined : star)}
              role="button"
              // El estado va también en el `aria`: el relleno es la única pista
              // de cuánto lleva, y el color no llega a quien no lo ve.
              aria-label={`${label}: ${star} de 5`}
              aria-pressed={value === star}
              className="size-14 items-center justify-center active:scale-95"
            >
              <Icon
                as={StarIcon}
                size={48}
                // El relleno lo pone `fill`, no el color del trazo: una estrella
                // solo contorneada no se lee como «medio puesta».
                fill={filled ? "#1c2e1a" : "white"}
                opacity={filled ? 0.95 : 1}
                className={filled ? "text-foreground" : "text-border"}
                strokeWidth={1.4}
                /**
                 * **El grosor, en píxeles reales.** `strokeWidth` va en unidades
                 * del `viewBox` —24 en lucide—, así que a `size={40}` todo se
                 * escala ×1.67 y un `strokeWidth={1}` se dibujaba con ~1.67 px:
                 * el mismo `border-border` que las píldoras del `OptionPicker`,
                 * pero con un 67 % más de tinta, y por eso se veía más oscuro
                 * aunque el color fuera idéntico.
                 *
                 * Con esto lucide divide entre la escala (`× 24 / size`) y el
                 * trazo sale de 1 px, igual que el `border` de las píldoras. Y
                 * sigue cuadrando si algún día cambia el `size`.
                 */
                absoluteStrokeWidth
              />
            </Pressable>
          );
        })}
      </View>

      <Text className="text-[13px] text-muted-foreground">
        {`1 — ${minLabel} · 5 — ${maxLabel}`}
      </Text>
    </View>
  );
}
