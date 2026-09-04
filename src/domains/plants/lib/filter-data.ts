import type {
  Plant,
  PlantWithMatch,
  FieldMatch,
  MatchableField,
} from "../types";
import { normalizeText } from "./normalize-text";

const MATCHABLE_FIELDS: MatchableField[] = [
  "name",
  "campo",
  "cuadro",
  "programa",
  "portainjerto",
  "anio",
];

export const findFirstMatch = (
  item: Plant,
  query: string,
): FieldMatch | undefined => {
  const normalizedQuery = normalizeText(query);

  for (const field of MATCHABLE_FIELDS) {
    const normalizedValue = normalizeText(String(item[field]));
    const index = normalizedValue.indexOf(normalizedQuery);

    if (index !== -1) {
      return { field, index, length: normalizedQuery.length };
    }
  }
  return undefined;
};

export const filterAndMatchData = (
  data: Plant[],
  query: string,
): PlantWithMatch[] => {
  const trimmed = query.trim();

  if (!trimmed) {
    return data.map((plantItem) => ({ plantItem }));
  }

  return data
    .map((plantItem) => ({
      plantItem,
      match: findFirstMatch(plantItem, trimmed),
    }))
    .filter((result) => result.match !== undefined);
};
