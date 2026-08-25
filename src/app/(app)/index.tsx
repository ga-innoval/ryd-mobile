import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { EvalsEmptyState } from "@/domains/evals/components/evals-lsit-empty-state";
import { EvalsList } from "@/domains/evals/components/evals-list";
import { EvalsPageHeader } from "@/domains/navigation/evals-page-header";
import { EvalsListSearchBar } from "@/domains/evals/components/evals-list-searchbar";
import { useSearchbar } from "@/domains/evals/hooks/use-searchbar";
import { filterAndMatchData } from "@/domains/evals/lib/filter-data";
import { DownloadStatus, EvaluacionWithMatch } from "@/domains/evals/types";
import { useDownloadStatus } from "@/domains/evals/hooks/use-download-status";
import { useEvalsDataStore } from "@/domains/evals/store/data-store";
import { useEvalsFilter } from "@/domains/evals/hooks/use-filter";
import { useScrollToTopButton } from "@/domains/evals/hooks/use-scroll-to-top-button";
import { ScrollToTopButton } from "@/domains/evals/components/scroll-to-top-button";
import { ListHeader } from "@/domains/evals/components/list-header";

export default function Index() {
  const { data, fetching } = useEvalsDataStore();
  const { triggerDownload, status } = useDownloadStatus();

  const { listRef, scrollHandler, buttonAnimatedStyle, scrollToTop } =
    useScrollToTopButton<EvaluacionWithMatch>();

  const { searchQuery, debouncedQuery, setSearchQuery, clearQuery } =
    useSearchbar();

  const filteredByText = useMemo(
    () => filterAndMatchData(data, debouncedQuery),
    [data, debouncedQuery],
  );

  const { selectedFilter, setSelectedFilter, filterItems, filteredData } =
    useEvalsFilter(filteredByText);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [selectedFilter, debouncedQuery]);

  const headerOptions = useMemo(
    () => ({
      header: () => (
        <EvalsPageHeader
          loadedCount={filteredData.length}
          totalCount={data.length}
        />
      ),
    }),
    [data.length, filteredData.length, fetching],
  );

  const listHeaderComponent = useMemo(
    () => (
      <ListHeader
        filterItems={filterItems}
        selectedFilter={selectedFilter}
        setSelectedFilter={setSelectedFilter}
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
      <View className="bg-primary px-4 pb-4">
        <EvalsListSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onCleaQuery={clearQuery}
        />
      </View>
      <EvalsList
        ref={listRef}
        data={filteredData}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={emptyStateComponent}
      />

      <ScrollToTopButton onPress={scrollToTop} style={buttonAnimatedStyle} />
    </View>
  );
}
