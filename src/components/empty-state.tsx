import { ReactNode } from "react";
import { View } from "react-native";
import { LucideIcon } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  body?: string;
  renderAction?: () => ReactNode;
};

export function EmptyState({
  icon,
  title,
  body,
  renderAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-24 px-4 gap-2">
      {icon && <Icon as={icon} size={48} className="opacity-45 mb-1" />}

      <Text className="font-medium text-center">{title}</Text>

      {body && (
        <Text variant="muted" className="text-center">
          {body}
        </Text>
      )}

      {renderAction && <View className="mt-2">{renderAction()}</View>}
    </View>
  );
}
