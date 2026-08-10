import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { EvalsEmptyState } from "@/domains/evals/components/evals-lsit-empty-state";
import { EvalsList } from "@/domains/evals/components/evals-list";
import { useDebouncedValue } from "@/domains/evals/hooks/use-debounced-value";
import { filterData } from "@/domains/evals/lib/filter-data";
import { MOCK_EVALS_DATA } from "@/domains/evals/lib/mock-data";
import { EvalsListHeader } from "@/domains/navigation/evals-list-header";
import type { Evaluacion } from "@/domains/evals/types";
import { EvalsListSearchBar } from "@/domains/evals/components/evals-list-searchbar";

export default function Index() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [data, setData] = useState<Evaluacion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  const filteredData = useMemo(
    () => filterData(data, debouncedQuery),
    [data, debouncedQuery],
  );

  const downloadData = useCallback(() => {
    setIsLoading(true);

    setTimeout(() => {
      setData(MOCK_EVALS_DATA);
      setIsLoading(false);
    }, 1_000 * 2);
  }, []);

  const clearQuery = useCallback(() => setSearchQuery(""), []);

  const headerOptions = useMemo(
    () => ({
      header: () => (
        <EvalsListHeader
          section="Evaluaciones"
          loadedCount={filteredData.length}
          totalCount={data.length}
          hasPendingChanges={true}
          isSyncing={isLoading}
          onSync={downloadData}
        />
      ),
    }),
    [data.length, filteredData.length, isLoading],
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={headerOptions} />
      <View className="bg-primary px-6 pb-6">
        <EvalsListSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onCleaQuery={clearQuery}
        />
      </View>
      <EvalsList
        data={filteredData}
        EmptyStateComponent={
          <EvalsEmptyState
            dataLength={data.length}
            searchQuery={searchQuery}
            onClearQuery={clearQuery}
            onDownloadData={downloadData}
            downloading={isLoading}
          />
        }
      />
    </View>
  );
}
