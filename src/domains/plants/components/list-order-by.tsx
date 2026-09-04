import { Icon } from "@/components/ui/icon";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TriggerRef } from "@rn-primitives/select";
import { ArrowDownNarrowWide, ArrowUpDown } from "lucide-react-native";
import { useRef } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { OrderByField } from "../types";
import { IconButton } from "@/components/ui/icon-button";

type orderByOption = { label: string; value: OrderByField };

type ListOrderByProps = {
  orderBy: OrderByField;
  onOrderByChange: (field: OrderByField) => void;
};

const orderByOptions: orderByOption[] = [
  { label: "Variedad", value: "name" },
  { label: "Campo", value: "campo" },
  { label: "Cuadro", value: "cuadro" },
  { label: "Programa", value: "programa" },
  { label: "Patrón", value: "portainjerto" },
  { label: "Año", value: "anio" },
];

export function ListOrderBy({ orderBy, onOrderByChange }: ListOrderByProps) {
  const ref = useRef<TriggerRef>(null);
  const insets = useSafeAreaInsets();
  const contentInsets = {
    top: insets.top,
    bottom: Platform.select({
      ios: insets.bottom,
      android: insets.bottom + 24,
    }),
    left: 12,
    right: 12,
  };

  const selectedOption = orderByOptions.find((o) => o.value === orderBy);

  return (
    <View className="flex flex-row justify-center items-center gap-1">
      <Select
        value={selectedOption}
        onValueChange={(option) => {
          if (option) onOrderByChange(option.value as OrderByField);
        }}
      >
        <SelectTrigger
          ref={ref}
          className="items-center justify-center rounded-full border px-4 py-1 bg-foreground/90 border-white"
          iconClassName="text-primary-foreground"
        >
          <Icon as={ArrowUpDown} className="text-primary-foreground" />
          <SelectValue
            className="text-primary-foreground"
            placeholder="Ordenar por"
          />
        </SelectTrigger>
        <SelectContent insets={contentInsets}>
          <SelectGroup>
            <SelectLabel>Ordenar por</SelectLabel>
            {orderByOptions.map((option) => (
              <SelectItem
                key={option.value}
                label={option.label}
                value={option.value}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <IconButton
        className="bg-foreground/90"
        accessibilityRole="button"
        accessibilityLabel="toggle asc desc"
      >
        <Icon
          //   as={ArrowUpWideNarrow}
          as={ArrowDownNarrowWide}
          size={18}
          className="text-primary-foreground"
        />
      </IconButton>
    </View>
  );
}
