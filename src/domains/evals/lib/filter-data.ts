import type {
  Evaluacion,
  EvaluacionWithMatch,
  FieldMatch,
  MatchableField,
} from "../types";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const filterData = (data: Evaluacion[], query: string): Evaluacion[] => {
  if (!query.trim()) return data;

  const normalizedQuery = normalize(query);

  return data.filter((item) =>
    [item.name, item.campo, item.cuadro, item.programa, item.patron].some(
      (field) => normalize(String(field)).includes(normalizedQuery),
    ),
  );
};

const MATCHABLE_FIELDS: MatchableField[] = [
  "name",
  "campo",
  "cuadro",
  "programa",
  "patron",
  "anio",
];

export const filterAndMatchData = (
  data: Evaluacion[],
  query: string,
): EvaluacionWithMatch[] => {
  const trimmed = query.trim();
  if (!trimmed) return data.map((item) => ({ evalItem: item }));

  const normalizedQuery = normalize(trimmed);
  const results: EvaluacionWithMatch[] = [];

  for (const item of data) {
    let match: FieldMatch | undefined;

    for (const field of MATCHABLE_FIELDS) {
      const normalizedValue = normalize(String(item[field]));
      const index = normalizedValue.indexOf(normalizedQuery);
      if (index !== -1) {
        match = { field, index, length: normalizedQuery.length };
        break; // solo el primer campo que hace match
      }
    }

    if (match) results.push({ evalItem: item, match });
  }

  return results;
};
