import { CloudDownloadIcon, FileXIcon, SearchXIcon } from "lucide-react-native";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

interface EvalsListEmptyStateProps {
  dataLength: number;
  searchQuery: string;
  onClearQuery: () => void;
  onDownloadData: () => void;
}

export function EvalsEmptyState({
  dataLength,
  searchQuery,
  onClearQuery,
  onDownloadData,
}: EvalsListEmptyStateProps) {
  if (dataLength === 0) {
    return (
      <EmptyState
        icon={FileXIcon}
        title="No hay evaluaciones registradas"
        renderAction={() => (
          <Button onPress={onDownloadData}>
            <Icon as={CloudDownloadIcon} />
            <Text>Descargar</Text>
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
          <Text
            className="text-primary font-bold"
            onPress={onClearQuery}
            accessibilityRole="button"
          >
            Limpiar búsqueda
          </Text>
        )}
      />
    );
  }
  return null;
}
