import { useCallback, useMemo, useState } from "react";
import type { OrderByField, OrderDirection, Plant } from "../types";
import { sortPlants } from "../lib/sort-plants";

export function usePlantsOrder(plants: Plant[]) {
  const [orderBy, setOrderBy] = useState<OrderByField>("name");
  const [direction, setDirection] = useState<OrderDirection>("asc");

  const orderedPlants = useMemo(
    () => sortPlants(plants, orderBy, direction),
    [plants, orderBy, direction],
  );

  const toggleDirection = useCallback(
    () => setDirection((current) => (current === "asc" ? "desc" : "asc")),
    [],
  );

  return { orderBy, setOrderBy, direction, toggleDirection, orderedPlants };
}
