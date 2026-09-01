import { View } from "react-native";

function Bone({ className }: { className: string }) {
  return <View className={`rounded-md bg-muted ${className}`} />;
}

export function PlantCardSkeleton() {
  return (
    <View className="rounded-xl border-2 border-border bg-card p-4 gap-4 animate-pulse-deep">
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
  );
}
