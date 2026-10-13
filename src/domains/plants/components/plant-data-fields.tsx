import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { HighlightedText } from "@/components/highlighted-text";
import { cn } from "@/lib/utils";
import type { FieldMatch, MatchableField, PlantRecord } from "../types";

/**
 * Los cinco datos que identifican una plantación, y cómo se escriben.
 *
 * **Una sola lista para toda la app.** Los enseñan la tarjeta del listado y el
 * diálogo de sincronización, y son los mismos cinco: con dos copias, agregar un
 * dato o cambiar su mayúscula dejaría a uno de los dos contando otra cosa.
 * `cuadro` y `programa` en mayúsculas y los nombres capitalizados, porque así
 * los escribe el backend y así los dicen los evaluadores.
 */
const DATA_FIELD_CONFIG: {
  label: string;
  key: MatchableField;
  valueCn: string;
}[] = [
  { label: "Campo", key: "campo", valueCn: "capitalize" },
  { label: "Cuadro", key: "cuadro", valueCn: "uppercase" },
  { label: "Programa", key: "programa", valueCn: "uppercase" },
  { label: "Patrón", key: "portainjerto", valueCn: "capitalize" },
  { label: "Año", key: "anio", valueCn: "" },
];

const DataField = ({
  label,
  value,
  match,
  valueCn,
  compact,
}: {
  label: string;
  value: string | number;
  match?: FieldMatch;
  valueCn: string;
  compact: boolean;
}) => (
  <View className="flex-row items-center gap-2">
    <Text variant="muted" className={cn(compact && "text-xs")}>
      {label}
    </Text>
    <HighlightedText
      className={cn("font-medium", compact && "text-xs", valueCn)}
      text={String(value).toLocaleLowerCase()}
      match={match}
    />
  </View>
);

/**
 * La fila de datos del encabezado de una plantación.
 *
 * `compact` la encoge para cuando no es la cabecera de su propia tarjeta sino
 * un renglón dentro de otra cosa —el diálogo de sincronización—: los mismos
 * datos en el mismo orden, con menos peso.
 *
 * `match` resalta lo que coincide con la búsqueda, y por eso cada campo recibe
 * solo el suyo: el resaltado es de un campo, no de la fila.
 */
export function PlantDataFields({
  plant,
  match,
  compact = false,
}: {
  plant: PlantRecord;
  match?: FieldMatch;
  compact?: boolean;
}) {
  return (
    <View className={cn("flex-row flex-wrap", compact ? "gap-3" : "gap-4")}>
      {DATA_FIELD_CONFIG.map(({ label, key, valueCn }) => (
        <DataField
          key={key}
          label={label}
          value={plant[key]}
          valueCn={valueCn}
          compact={compact}
          match={match?.field === key ? match : undefined}
        />
      ))}
    </View>
  );
}
