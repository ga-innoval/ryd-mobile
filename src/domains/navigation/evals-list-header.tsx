import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Leaf, RefreshCw } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";

type AppHeaderProps = {
  section: string;
  loadedCount?: number;
  totalCount?: number;
  hasPendingChanges?: boolean;
  isSyncing?: boolean;
  onSync?: () => void;
};

export function EvalsListHeader({
  section,
  loadedCount,
  totalCount,
  hasPendingChanges,
  isSyncing,
  onSync,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top }} className="bg-primary">
      <View className="flex-row items-center justify-between px-6 h-14">
        <View className="flex-row items-center gap-2">
          <Icon as={Leaf} size={18} className="text-green-400" />
          <Text className="text-primary-foreground font-bold">VitEval</Text>
          <Text className="text-primary-foreground/40">/</Text>
          <Text className="text-primary-foreground/80">{section}</Text>
        </View>

        <View className="flex-row items-center gap-3">
          {totalCount != null && (
            <Text className="text-primary-foreground/80 text-sm">
              {loadedCount} de {totalCount} variedades
            </Text>
          )}

          {hasPendingChanges && (
            <>
              <View className="w-px h-4 bg-primary-foreground/20" />
              <View className="flex-row items-center gap-1.5">
                <View className="w-2 h-2 rounded-full bg-orange-400" />
                <Text className="text-primary-foreground/80 text-sm">
                  Cambios pendientes
                </Text>
              </View>
            </>
          )}

          <Pressable
            onPress={onSync}
            disabled={isSyncing}
            accessibilityRole="button"
            accessibilityLabel="Sincronizar cambios"
            className="w-8 h-8 rounded-full bg-primary-foreground/15 items-center justify-center"
          >
            <Icon
              as={RefreshCw}
              size={16}
              className="text-primary-foreground"
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
