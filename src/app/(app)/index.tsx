import { useMemo } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { EvalsEmptyState } from "@/domains/evals/components/evals-lsit-empty-state";
import { EvalsList } from "@/domains/evals/components/evals-list";
import { EvalsListHeader } from "@/domains/navigation/evals-list-header";
import { EvalsListSearchBar } from "@/domains/evals/components/evals-list-searchbar";
import { useSearchbar } from "@/domains/evals/hooks/use-searchbar";
import { filterAndMatchData } from "@/domains/evals/lib/filter-data";
import { DownloadStatus } from "@/domains/evals/types";
import { useDownloadStatus } from "@/domains/evals/hooks/use-download-status";
import { useEvalsDataStore } from "@/domains/evals/store/data-store";
import { useEvalsFilter } from "@/domains/evals/hooks/use-filter";
import { ListFilter } from "@/domains/evals/components/list-filter";

export default function Index() {
  const { data, fetching } = useEvalsDataStore();
  const { triggerDownload, status } = useDownloadStatus();

  const { searchQuery, debouncedQuery, setSearchQuery, clearQuery } =
    useSearchbar();
  const filteredByText = useMemo(
    () => filterAndMatchData(data, debouncedQuery),
    [data, debouncedQuery],
  );
  const { selectedFilter, setSelectedFilter, filterItems, filteredData } =
    useEvalsFilter(filteredByText);

  const headerOptions = useMemo(
    () => ({
      header: () => (
        <EvalsListHeader
          loadedCount={filteredData.length}
          totalCount={data.length}
        />
      ),
    }),
    [data.length, filteredData.length, fetching],
  );

  const listHeaderComponent = useMemo(
    () => (
      <ListFilter
        selectedItem={selectedFilter}
        onItemPress={setSelectedFilter}
        items={filterItems}
      />
    ),
    [selectedFilter, filterItems],
  );

  const emptyStateComponent = useMemo(
    () => (
      <EvalsEmptyState
        dataLength={data.length}
        searchQuery={debouncedQuery}
        onClearQuery={clearQuery}
        onDownloadData={triggerDownload}
        downloading={status === DownloadStatus.downloading}
      />
    ),
    [data.length, debouncedQuery, clearQuery, triggerDownload, status],
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
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={emptyStateComponent}
      />
    </View>
  );
}
