import { CloudDownloadIcon, FileXIcon, SearchXIcon } from "lucide-react-native";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ActivityIndicator, Pressable, View } from "react-native";
import { PlantCardSkeleton } from "./plant-card-skeleton";

interface ListEmptyStateProps {
  isLoading: boolean;
  dataLength: number;
  searchQuery: string;
  onClearQuery: () => void;
  onDownloadData: () => void;
  downloading?: boolean;
}

export function ListEmptyState({
  isLoading,
  dataLength,
  searchQuery,
  onClearQuery,
  onDownloadData,
  downloading,
}: ListEmptyStateProps) {
  if (isLoading) {
    return (
      <View className="gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <PlantCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (dataLength === 0) {
    return (
      <EmptyState
        icon={FileXIcon}
        title="No hay plantaciones registradas en tu dispositivo"
        renderAction={() => (
          <Button disabled={downloading} onPress={() => onDownloadData()}>
            {downloading ? (
              <ActivityIndicator className="text-white" />
            ) : (
              <Icon as={CloudDownloadIcon} />
            )}
            <Text>{downloading ? "Descargando..." : "Descargar"}</Text>
          </Button>
        )}
      />
    );
  }
  if (searchQuery.trim() !== "") {
    return (
      <EmptyState
        icon={SearchXIcon}
        title={`Sin resultados para "${searchQuery}"`}
        renderAction={() => (
          <Pressable hitSlop={8} onPress={onClearQuery}>
            <Text className="text-primary font-bold">Limpiar búsqueda</Text>
          </Pressable>
        )}
      />
    );
  }

  return <EmptyState icon={SearchXIcon} title="Sin resultados" />;
}
