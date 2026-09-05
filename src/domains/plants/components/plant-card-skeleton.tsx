import { View } from "react-native";
import Animated from "react-native-reanimated";
import { usePulseAnimation } from "@/lib/use-pulse-animation";

function Bone({ className }: { className: string }) {
  return <View className={`rounded-lg bg-neutral-200/85 ${className}`} />;
}

export function PlantCardSkeleton() {
  const pulseStyle = usePulseAnimation({ minOpacity: 0.3 });

  return (
    <Animated.View style={pulseStyle}>
      <View className="rounded-xl border-2 border-border bg-card p-4 gap-4">
        {/* nombre variedad */}
        <View className="gap-2">
          <Bone className="h-6 w-40" />
        </View>

        {/* fila de datos (campo, cuadro, programa...) */}
        <View className="flex-row gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Bone key={i} className="h-3 w-28" />
          ))}
        </View>

        {/* sección tratamiento */}
        <Bone className="h-16 w-full rounded-xl" />

        {/* sección post cosecha */}
        <View>
          <Bone className="h-16 w-full rounded-xl" />
        </View>
      </View>
    </Animated.View>
  );
}
