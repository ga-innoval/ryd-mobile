import { useMemo, useState } from "react";
import { SyncStatus, type EvaluacionWithMatch } from "../types";
import { FilterValues } from "../types";

const FILTER_PREDICATES: Record<
  FilterValues,
  (item: EvaluacionWithMatch) => boolean
> = {
  [FilterValues.todas]: () => true,
  [FilterValues.sinIniciar]: (item) => item.evalItem.progress === 0,
  [FilterValues.iniciadas]: (item) => item.evalItem.progress > 0,
  [FilterValues.pendientes]: (item) =>
    item.evalItem.syncStatus === SyncStatus.pending,
};

export function useEvalsFilter(data: EvaluacionWithMatch[]) {
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
