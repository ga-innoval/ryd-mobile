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

export default function Index() {
  const { searchQuery, debouncedQuery, setSearchQuery, clearQuery } =
    useSearchbar();

  const { data, fetching } = useEvalsDataStore();
  const { triggerDownload, status } = useDownloadStatus();

  const filteredData = useMemo(
    () => filterAndMatchData(data, debouncedQuery),
    [data, debouncedQuery],
  );

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
            searchQuery={debouncedQuery}
            onClearQuery={clearQuery}
            onDownloadData={triggerDownload}
            downloading={status === DownloadStatus.downloading}
          />
        }
      />
    </View>
  );
}
