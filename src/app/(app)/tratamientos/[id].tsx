import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useTratamiento } from "@/domains/plants/hooks/use-tratamiento";

const PLANT_FIELDS = [
  { label: "Variedad", key: "name" },
  { label: "Campo", key: "campo" },
  { label: "Cuadro", key: "cuadro" },
  { label: "Programa", key: "programa" },
  { label: "Patrón", key: "portainjerto" },
  { label: "Año", key: "anio" },
] as const;

export default function TratamientoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useTratamiento(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  // Alcanzable de verdad, no defensivo: una descarga puede podar el
  // tratamiento mientras esta pantalla está abierta. No se navega hacia atrás
  // solo, que resulta brusco si el usuario está leyendo.
  if (!data) {
    return (
      <View className="flex-1 items-center justify-center gap-2 p-6">
        <Stack.Screen options={{ title: "Tratamiento" }} />
        <Text variant="large">Tratamiento no disponible</Text>
        <Text variant="muted" className="text-center">
          Puede que se haya eliminado en la última descarga.
        </Text>
      </View>
    );
  }

  const { tratamiento, plant } = data;

  return (
    <View className="flex-1 bg-background p-4 gap-4">
      <Stack.Screen options={{ title: tratamiento.name }} />

      <View className="gap-1">
        <Text variant="h3">{tratamiento.name}</Text>
        {tratamiento.description !== "" && (
          <Text variant="muted">{tratamiento.description}</Text>
        )}
        <Text variant="muted">Temporada {tratamiento.temporada}</Text>
      </View>

      <View className="rounded-xl border-2 border-border bg-card p-4 gap-2">
        {PLANT_FIELDS.map(({ label, key }) => (
          <View key={key} className="flex-row gap-2 items-center">
            <Text variant="muted">{label}</Text>
            <Text className="font-medium">{String(plant[key])}</Text>
          </View>
        ))}
      </View>

      {/* TODO(respuestas): el progreso depende de la captura, que aún no existe. */}
    </View>
  );
}
