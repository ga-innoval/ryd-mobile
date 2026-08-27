import { cn } from "@/lib/utils";
import { View } from "react-native";

export function StatusDot({
  dotClassName,
  visible,
  animated,
}: {
  dotClassName: string;
  visible: boolean;
  animated: boolean;
}) {
  return (
    <View
      className={cn(
        "w-2 h-2 rounded-full",
        animated && "animate-pulse-deep",
        dotClassName,
        visible ? "flex" : "hidden",
      )}
    />
  );
}
