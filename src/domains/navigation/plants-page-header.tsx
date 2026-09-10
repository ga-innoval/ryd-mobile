import { View } from "react-native";
import { Leaf } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { UserMenu } from "@/components/user-menu";
import { SyncBlock } from "../plants/components/sync-block";
import { DownloadBlock } from "../plants/components/download-block";
import { HeaderBase } from "./header-base";

type PlantsPageHeaderProps = {
  section?: string;
  loadedCount?: number;
  totalCount: number;
  isLoading?: boolean;
};

export function PlantsPageHeader({
  section,
  loadedCount,
  totalCount,
  isLoading,
}: PlantsPageHeaderProps) {
  return (
    <HeaderBase>
      <View className="flex-row items-center gap-2">
        <Icon as={Leaf} size={18} className="text-leaf" />
        <Text className="text-primary-foreground font-bold">CapExp</Text>
        {section && (
          <>
            <Text className="text-primary-foreground/40">/</Text>
            <Text className="text-primary-foreground/80">{section}</Text>
          </>
        )}
      </View>

      <View className="flex-row items-center gap-3">
        <DownloadBlock
          totalCount={totalCount}
          loadedCount={loadedCount}
          isLoading={isLoading}
        />
        <SeparatorLine />
        <SyncBlock disabled={totalCount === 0} />
        <SeparatorLine />
        <UserMenu />
      </View>
    </HeaderBase>
  );
}

function SeparatorLine() {
  return <View className="w-px h-4 bg-primary-foreground/20" />;
}
