import { useCallback, useMemo, useState } from "react";
import type { Evaluacion } from "@/domains/evals/types";
import { View } from "react-native";
import { Stack } from "expo-router";
import { EvalsEmptyState } from "@/domains/evals/components/evals-lsit-empty-state";
import { EvalsList } from "@/domains/evals/components/evals-list";
import { MOCK_EVALS_DATA } from "@/domains/evals/lib/mock-data";
import { EvalsListHeader } from "@/domains/navigation/evals-list-header";
import { EvalsListSearchBar } from "@/domains/evals/components/evals-list-searchbar";
import { useSearchbar } from "@/domains/evals/hooks/use-searchbar";
import { filterData } from "@/domains/evals/lib/filter-data";

export default function Index() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [data, setData] = useState<Evaluacion[]>([]);
  const { searchQuery, debouncedQuery, setSearchQuery, clearQuery } =
    useSearchbar();

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
