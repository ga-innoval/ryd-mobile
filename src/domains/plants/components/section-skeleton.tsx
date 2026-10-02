import { View } from "react-native";
import Animated from "react-native-reanimated";
import { usePulseAnimation } from "@/lib/use-pulse-animation";

/** Los anchos de una fila, en píxeles: título, descripción y resumen. */
export type SectionSkeletonRow = {
  title: number;
  description: number;
  summary: number;
};

/**
 * El hueco mientras una pantalla de captura se monta.
 *
 * No tapa una espera de red: lo que cuesta es **pintar** las secciones, que
 * nacen abiertas. Durante ese render el hilo de JS está bloqueado y no puede
 * pintar nada nuevo, así que lo que se ve es lo último que se comprometió — por
 * eso esto se queda en pantalla el rato entero y no parpadea.
 *
 * Imita solo las **cabeceras cerradas**, no los cuerpos. Es lo que de verdad
 * aparece después —las cabeceras están siempre; lo que varía es lo de dentro—, y
 * una plantilla fiel a cada cuerpo sería una copia que se desincroniza al primer
 * cambio de layout.
 *
 * Lo comparten las dos pantallas de captura porque lo que imita es la forma de
 * `CollapsibleHeader`, que es la misma en las dos; lo que cambia es cuántas
 * filas y cuánto mide el texto de cada una, y eso lo pone quien lo monta.
 */
export function SectionSkeleton({
  rows,
  reservedHeight,
}: {
  rows: SectionSkeletonRow[];
  /** El hueco del bloque superpuesto de la cabecera, para que la primera fila
   *  no quede debajo. */
  reservedHeight: number;
}) {
  const pulseStyle = usePulseAnimation({ minOpacity: 0.3 });

  return (
    <View className="flex-1 px-4">
      {/* El mismo espaciador que el scroll de verdad, o el primer hueco
          quedaría bajo el bloque superpuesto de la cabecera. */}
      <View style={{ height: reservedHeight }} />

      {/* Un solo `Animated.View` para todas: un pulso por fila serían tantas
          animaciones corriendo para decir lo mismo. */}
      <Animated.View style={pulseStyle}>
        {rows.map((row, index) => (
          <View key={index} className="bg-background pt-4">
            <View className="border-2 border-border bg-card rounded-xl">
              <View className="bg-secondary rounded-[10px]">
                <View className="flex-row items-center justify-between gap-2 px-4 py-3">
                  <View className="gap-1">
                    <View className="flex-row gap-2 items-center">
                      <View className="size-4 rounded bg-primary/20" />
                      {/* Anchos distintos por fila: barras idénticas se leen
                          como un patrón, no como texto cargando. */}
                      <View
                        className="h-6 rounded bg-foreground/15"
                        style={{ width: row.title }}
                      />
                    </View>
                    <View
                      className="h-6 rounded bg-foreground/10"
                      style={{ width: row.description }}
                    />
                  </View>

                  <View className="size-5 rounded-full bg-foreground/10" />
                </View>

                {/* La tercera fila del resumen —«0 de 16 preguntas»—, que la
                    llevan todas las secciones. Sin ella el esqueleto medía 64
                    px contra los 112 de la cabecera real y el salto se veía. */}
                <View className="px-4 pb-3">
                  <View
                    className="h-5 rounded bg-foreground/10"
                    style={{ width: row.summary }}
                  />
                </View>
              </View>
            </View>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}
