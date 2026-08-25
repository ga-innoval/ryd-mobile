import { Pressable, PressableProps, View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { FilterValues } from "../types";
import { Dispatch, SetStateAction } from "react";

const ToggleItemVariantsCn = {
  default: {
    container: "bg-primary/10 border-primary/30",
    text: "",
  },
  selected: {
    container: "bg-foreground/90 border-white",
    text: "text-primary-foreground",
  },
};

interface ToggleItemProps extends PressableProps {
  variant: "default" | "selected";
  text: string;
}

function ToggleItem({
  variant = "default",
  text,
  className,
  ...props
}: ToggleItemProps) {
  const containerCn = ToggleItemVariantsCn[variant].container;
  const textCn = ToggleItemVariantsCn[variant].text;

  return (
    <Pressable
      className={cn(
        "items-center justify-center rounded-full border px-4 py-1",
        containerCn,
        className,
      )}
      {...props}
    >
      <Text className={cn("font-medium", textCn)}>{text}</Text>
    </Pressable>
  );
}

type FilterItem = {
  label: string;
  value: FilterValues;
  count?: number;
};

interface ListFilterProps {
  selectedItem: string;
  onItemPress: Dispatch<SetStateAction<FilterValues>>;
  items: FilterItem[];
}

export function ListFilter({
  selectedItem,
  onItemPress,
  items,
}: ListFilterProps) {
  return (
    <View className="flex flex-row gap-2">
      {items.map(({ label, value, count }) => (
        <ToggleItem
          key={label}
          onPress={() => onItemPress(value)}
          text={count !== undefined ? `${label} (${count})` : label}
          variant={selectedItem === value ? "selected" : "default"}
        />
      ))}
    </View>
  );
}
