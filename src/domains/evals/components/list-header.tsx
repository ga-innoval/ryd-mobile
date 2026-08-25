import { useState } from "react";
import { View, ScrollView } from "react-native";
import { Separator } from "@/components/ui/separator";
import { ListFilter } from "./list-filter";
import { ListOrderBy } from "./list-order-by";
import { FilterValues } from "../types";
import type { Dispatch, SetStateAction } from "react";

type FilterItem = { label: string; value: FilterValues; count?: number };

interface ListHeaderProps {
  selectedFilter: string;
  setSelectedFilter: Dispatch<SetStateAction<FilterValues>>;
  filterItems: FilterItem[];
}

export function ListHeader({
  selectedFilter,
  setSelectedFilter,
  filterItems,
}: ListHeaderProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const measured = containerWidth > 0 && contentWidth > 0;
  const fits = measured && contentWidth <= containerWidth;

  return (
    <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {/* Medidor invisible */}
      <View
        className="absolute flex-row items-center justify-between gap-2 py-3"
        style={{ left: -9999, opacity: 0 }}
        pointerEvents="none"
        onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
      >
        <ListFilter
          selectedItem={selectedFilter}
          onItemPress={() => {}}
          items={filterItems}
        />
        <ListOrderBy />
      </View>

      {!measured || fits ? (
        <View className="flex flex-row items-center justify-between gap-2 py-3">
          <ListFilter
            selectedItem={selectedFilter}
            onItemPress={setSelectedFilter}
            items={filterItems}
          />
          <ListOrderBy />
        </View>
      ) : (
        <ScrollView
          className="-mr-4 -ml-4"
          contentContainerClassName="flex flex-row items-center gap-2 py-3 px-4"
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <ListFilter
            selectedItem={selectedFilter}
            onItemPress={setSelectedFilter}
            items={filterItems}
          />
          <Separator orientation="vertical" />
          <View className="ml-auto">
            <ListOrderBy />
          </View>
        </ScrollView>
      )}
    </View>
  );
}
