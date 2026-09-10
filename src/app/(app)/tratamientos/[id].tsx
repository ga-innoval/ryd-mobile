import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useTratamiento } from "@/domains/plants/hooks/use-tratamiento";
import { TratamientosPageHeader } from "@/domains/navigation/tratamientos-page-header";
import {
  TratamientoChip,
  TratamientoChipSkeleton,
} from "@/domains/plants/components/tratamiento-chip";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { FrownIcon, GhostIcon } from "lucide-react-native";

// const PLANT_FIELDS = [
//   { label: "Cuadro", key: "cuadro", valueCn: "uppercase" },
//   { label: "Programa", key: "programa", valueCn: "uppercase" },
//   { label: "Patrón", key: "portainjerto", valueCn: "capitalize" },
//   { label: "Año", key: "anio", valueCn: "" },
// ] as const;

export default function TratamientoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useTratamiento(id);
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      {/* Se registra fuera de cualquier rama para que el header exista desde
          el primer frame: su estructura ya es visible mientras carga y solo
          los nombres son skeleton, así no hay salto de layout al llegar el
          dato ni una pantalla sin cabecera. */}
      <Stack.Screen
        options={{
          title: data?.tratamiento.name ?? "Tratamiento",
          header: () => (
            <TratamientosPageHeader
              tratamiento={data?.tratamiento}
              plant={data?.plant}
              isLoading={isLoading}
            />
          ),
        }}
      />

      {/* Acceso rápido a los demás tratamientos de la plantación. Comparte
          `bg-primary` con el header para leerse como parte de él, igual que la
          barra de búsqueda en `index.tsx`. Los márgenes negativos dejan que el
          scroll llegue a los bordes sin perder el padding del contenido. */}
      {/* Con un solo tratamiento la barra sería un chip que apunta a sí mismo.
          Mientras carga sí se muestra: el caso común tiene varios, y esconderla
          por defecto haría que apareciera de golpe en cuanto llega el dato. */}
      {(isLoading || (data && data.tratamientos.length > 1)) && (
        <View className="bg-primary px-4 pb-3">
          <ScrollView
            className="-mx-4"
            contentContainerClassName="flex-row items-center gap-2 px-4"
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TratamientoChipSkeleton key={i} />
                ))
              : data?.tratamientos.map((trat) => (
                  // El resaltado se compara contra el `id` de la ruta y no
                  // contra el dato cargado: `setParams` lo actualiza al
                  // instante, así que el chip se invierte en el mismo frame
                  // del toque y el contenido llega detrás.
                  <TratamientoChip
                    key={trat.id}
                    tratamiento={trat}
                    variant="header"
                    isActive={trat.id === id}
                    // Mismo screen, otro parámetro: `setParams` cambia los
                    // params sin navegar, así que no hay transición ni
                    // remonte. `replace` sí navegaba, y de ahí la animación
                    // que sobraba.
                    onPress={() => router.setParams({ id: trat.id })}
                  />
                ))}
          </ScrollView>
        </View>
      )}

      {/* Alcanzable de verdad, no defensivo: una descarga puede podar el
          tratamiento mientras esta pantalla está abierta. No se navega hacia
          atrás solo, que resulta brusco si el usuario está leyendo. */}
      {!isLoading && !data && (
        <EmptyState
          icon={GhostIcon}
          title="Tratamiento no disponible"
          body="Puede que se haya eliminado en la última descarga."
        />
      )}

      {/* <View className="flex-row bg-primary px-4 pb-2 gap-4">
        {PLANT_FIELDS.map(({ label, key, valueCn }) => (
          <View key={key} className="flex-row gap-2 items-center">
            <Text variant="muted" className="text-primary-foreground/60">
              {label}
            </Text>
            <Text
              className={cn(
                "font-semibold text-sm text-primary-foreground",
                valueCn,
              )}
            >
              {String(plant[key])}
            </Text>
          </View>
        ))}
      </View> */}

      {/* TODO(respuestas): el progreso depende de la captura, que aún no existe. */}
    </View>
  );
}
