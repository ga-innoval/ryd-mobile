import type { Evaluacion } from "../types";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function filterData(data: Evaluacion[], query: string): Evaluacion[] {
  if (!query.trim()) return data;

  const normalizedQuery = normalize(query);

  return data.filter((item) =>
    [item.name, item.campo, item.cuadro, item.programa, item.patron].some(
      (field) => normalize(String(field)).includes(normalizedQuery),
    ),
  );
}
