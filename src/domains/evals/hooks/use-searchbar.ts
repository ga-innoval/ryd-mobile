import { useCallback, useState } from "react";
import { useDebouncedValue } from "./use-debounced-value";

export function useSearchbar() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  const clearQuery = useCallback(() => setSearchQuery(""), []);

  return { searchQuery, debouncedQuery, setSearchQuery, clearQuery };
}
