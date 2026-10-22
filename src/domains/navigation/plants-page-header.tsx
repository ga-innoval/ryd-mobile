import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { UserMenu } from "@/components/user-menu";
import { SyncBlock } from "../plants/components/sync-block";
import { DownloadBlock } from "../plants/components/download-block";
import { HeaderBase } from "./header-base";
import { SeparatorLine } from "@/components/ui/separator-line";
import { NotificationsBell } from "@/domains/notifications/components/notifications-bell";
import { Image } from "expo-image";

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
        <Image
          className="h-8 w-8"
          source={require("../../../assets/images/logo-light.png")}
        />
        <Text className="text-primary-foreground font-bold -m-0.5">CapExp</Text>
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
        <NotificationsBell />
        <UserMenu />
      </View>
    </HeaderBase>
  );
}
