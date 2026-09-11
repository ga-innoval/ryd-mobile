import * as ToggleGroupPrimitive from "@rn-primitives/toggle-group";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { FilterValues } from "../types";

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

type FilterItem = {
  label: string;
  value: FilterValues;
  count?: number;
};

interface ListFilterProps {
  selectedItem: string;
  onItemPress: (value: FilterValues) => void;
  items: FilterItem[];
}

export function ListFilter({
  selectedItem,
  onItemPress,
  items,
}: ListFilterProps) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={selectedItem}
      // El primitivo emite `undefined` al pulsar la opción ya activa, que sería
      // deseleccionar. Aquí siempre hay un filtro vigente —"Todas" es el
      // neutro—, así que ese caso se ignora en vez de dejar la lista sin
      // criterio.
      onValueChange={(next) => {
        if (next) onItemPress(next as FilterValues);
      }}
      className="flex flex-row gap-2"
    >
      {items.map(({ label, value, count }) => {
        const isSelected = ToggleGroupPrimitive.utils.getIsSelected(
          selectedItem,
          value,
        );
        const styles =
          ToggleItemVariantsCn[isSelected ? "selected" : "default"];

        return (
          <ToggleGroupPrimitive.Item
            key={value}
            value={value}
            className={cn(
              "items-center justify-center rounded-full border px-4 py-1",
              styles.container,
            )}
          >
            <Text className={cn("font-medium", styles.text)}>
              {count !== undefined ? `${label} (${count})` : label}
            </Text>
          </ToggleGroupPrimitive.Item>
        );
      })}
    </ToggleGroupPrimitive.Root>
  );
}
