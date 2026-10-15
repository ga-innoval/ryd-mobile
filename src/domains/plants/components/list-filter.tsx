import * as ToggleGroupPrimitive from "@rn-primitives/toggle-group";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

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

type FilterItem<T extends string> = {
  label: string;
  value: T;
  count?: number;
};

interface ListFilterProps<T extends string> {
  selectedItem: string;
  onItemPress: (value: T) => void;
  items: FilterItem<T>[];
}

/**
 * Los chips de filtro. Genérico en el valor porque lo usan dos pantallas con
 * sus propios filtros —el listado y las notificaciones— y el estilo tiene que
 * ser el mismo.
 */
export function ListFilter<T extends string>({
  selectedItem,
  onItemPress,
  items,
}: ListFilterProps<T>) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={selectedItem}
      // El primitivo emite `undefined` al pulsar la opción ya activa, que sería
      // deseleccionar. Aquí siempre hay un filtro vigente —"Todas" es el
      // neutro—, así que ese caso se ignora en vez de dejar la lista sin
      // criterio.
      onValueChange={(next) => {
        if (next) onItemPress(next as T);
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
