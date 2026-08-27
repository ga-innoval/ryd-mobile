import { useMemo, useState } from "react";
import { SyncStatus, type PlantWithMatch } from "../types";
import { FilterValues } from "../types";

const FILTER_PREDICATES: Record<
  FilterValues,
  (item: PlantWithMatch) => boolean
> = {
  [FilterValues.todas]: () => true,
  [FilterValues.sinIniciar]: (item) => item.plantItem.progress === 0,
  [FilterValues.iniciadas]: (item) => item.plantItem.progress > 0,
  [FilterValues.pendientes]: (item) =>
    item.plantItem.syncStatus === SyncStatus.pending,
};

export function usePlantsFilter(data: PlantWithMatch[]) {
  const [selectedFilter, setSelectedFilter] = useState<FilterValues>(
    FilterValues.todas,
  );

  const filterItems = useMemo(
    () => [
      { label: "Todas", value: FilterValues.todas },
      {
        label: "Sin iniciar",
        value: FilterValues.sinIniciar,
        count: data.filter(FILTER_PREDICATES[FilterValues.sinIniciar]).length,
      },
      {
        label: "Iniciadas",
        value: FilterValues.iniciadas,
        count: data.filter(FILTER_PREDICATES[FilterValues.iniciadas]).length,
      },
      {
        label: "Pendientes",
        value: FilterValues.pendientes,
        count: data.filter(FILTER_PREDICATES[FilterValues.pendientes]).length,
      },
    ],
    [data],
  );

  const filteredData = useMemo(
    () => data.filter(FILTER_PREDICATES[selectedFilter]),
    [data, selectedFilter],
  );

  return { selectedFilter, setSelectedFilter, filterItems, filteredData };
}
