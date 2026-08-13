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

const MATCHABLE_FIELDS: MatchableField[] = [
  "name",
  "campo",
  "cuadro",
  "programa",
  "patron",
  "anio",
];

export const findFirstMatch = (
  item: Evaluacion,
  query: string,
): FieldMatch | undefined => {
  const normalizedQuery = normalize(query);

  for (const field of MATCHABLE_FIELDS) {
    const normalizedValue = normalize(String(item[field]));
    const index = normalizedValue.indexOf(normalizedQuery);

    if (index !== -1) {
      return { field, index, length: normalizedQuery.length };
    }
  }
  return undefined;
};

export const filterAndMatchData = (
  data: Evaluacion[],
  query: string,
): EvaluacionWithMatch[] => {
  const trimmed = query.trim();

  if (!trimmed) {
    return data.map((evalItem) => ({ evalItem }));
  }

  return data
    .map((evalItem) => ({
      evalItem,
      match: findFirstMatch(evalItem, trimmed),
    }))
    .filter((result) => result.match !== undefined);
};
