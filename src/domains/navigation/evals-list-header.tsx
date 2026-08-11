import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Leaf, RefreshCw } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/user-menu";

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
    <View style={{ paddingTop: insets.top + 12 }} className="bg-primary">
      <View className="flex-row items-center justify-between px-6 h-14">
        <View className="flex-row items-center gap-2">
          <Icon as={Leaf} size={18} className="text-green-400" />
          <Text className="text-primary-foreground font-bold">
            Captura Experimental
          </Text>
          <Text className="text-primary-foreground/40">/</Text>
          <Text className="text-primary-foreground/80">{section}</Text>
        </View>

        <View className="flex-row items-center gap-3">
          {totalCount != null && (
            <Text className="text-primary-foreground/80 text-sm">
              {loadedCount} de {totalCount} variedades
            </Text>
          )}

          <View className="w-px h-4 bg-primary-foreground/20" />
          <View
            className={cn(
              "flex-row items-center gap-1.5",
              isSyncing ? "flex" : "hidden",
            )}
          >
            <View className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <Text className="text-primary-foreground/80 text-sm">
              Sincronizando
            </Text>
          </View>

          <View
            className={cn(
              "flex-row items-center gap-1.5",
              hasPendingChanges && !isSyncing ? "flex" : "hidden",
            )}
          >
            <View className="w-2 h-2 rounded-full bg-orange-400" />
            <Text className="text-primary-foreground/80 text-sm">
              Cambios pendientes
            </Text>
          </View>

          <Pressable
            onPress={onSync}
            disabled={isSyncing}
            accessibilityRole="button"
            accessibilityLabel="Sincronizar cambios"
            className="w-8 h-8 rounded-full bg-primary-foreground/15 items-center justify-center"
          >
            <View className={isSyncing ? "animate-spin" : "animate-none"}>
              <Icon
                as={RefreshCw}
                size={16}
                className="text-primary-foreground"
              />
            </View>
          </Pressable>
          <UserMenu />
        </View>
      </View>
    </View>
  );
}
