import { View } from "react-native";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { PostCosechaEval } from "../lib/evals-post-cosecha";

/**
 * Una de las cuatro evaluaciones de post-cosecha, en la barra de acceso rápido
 * de la cabecera.
 *
 * Aparte de `TratamientoChip` y no una variante suya: aquél enseña **un** dato
 * —el nombre— más su avance y su error, y este enseña **dos** en dos líneas,
 * días arriba y empaque abajo. Unirlos pediría props opcionales para los dos
 * casos y un componente que no sabe cuál es.
 *
 * El aspecto sí se copia del `header` de aquél a propósito: van en la misma
 * barra, sobre el mismo verde, y dos chips vecinos que no se parecen se leen
 * como dos cosas distintas de la app.
 */
export function PostcosechaChip({
  evaluacion,
  isActive,
  onPress,
}: {
  evaluacion: PostCosechaEval;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      role="button"
      aria-label={`${evaluacion.title} ${evaluacion.subtitle}`}
      // `aria-current` y no solo el color: el resaltado es la única pista de en
      // cuál estás, y el color no llega a quien no lo ve.
      aria-current={isActive}
      className={cn(
        "w-28 items-center justify-center rounded-xl border border-primary-foreground/50 py-1",
        isActive && "border-primary-foreground/20 bg-primary-foreground/20",
      )}
    >
      <View className="items-center">
        <Text
          className={cn(
            "text-sm font-medium text-primary-foreground",
            isActive && "text-white",
          )}
        >
          {evaluacion.title}
        </Text>
        <Text className="text-xs text-primary-foreground/70">
          {evaluacion.subtitle}
        </Text>
      </View>
    </PressableScale>
  );
}
