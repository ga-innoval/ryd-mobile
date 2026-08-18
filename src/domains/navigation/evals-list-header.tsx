import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Leaf } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { UserMenu } from "@/components/user-menu";
import { SyncBlock } from "../evals/components/sync-block";
import { DownloadBlock } from "../evals/components/download-block";

type AppHeaderProps = {
  section?: string;
  loadedCount?: number;
  totalCount: number;
};

export function EvalsListHeader({
  section,
  loadedCount,
  totalCount,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top + 28 }} className="bg-primary">
      <View className="flex-row items-center justify-between px-6 h-14">
        <View className="flex-row items-center gap-2">
          <Icon as={Leaf} size={18} className="text-green-400" />
          <Text className="text-primary-foreground font-bold">
            Captura Experimental
          </Text>
          {section && (
            <>
              <Text className="text-primary-foreground/40">/</Text>
              <Text className="text-primary-foreground/80">{section}</Text>
            </>
          )}
        </View>

        <View className="flex-row items-center gap-3">
          <DownloadBlock totalCount={totalCount} loadedCount={loadedCount} />
          <SeparatorLine />
          <SyncBlock disabled={totalCount === 0} />
          <SeparatorLine />
          <UserMenu />
        </View>
      </View>
    </View>
  );
}

function SeparatorLine() {
  return <View className="w-px h-4 bg-primary-foreground/20" />;
}
