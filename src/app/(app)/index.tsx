import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { ListEmptyState } from "@/domains/plants/components/list-empty-state";
import { List } from "@/domains/plants/components/list";
import { PlantsPageHeader } from "@/domains/navigation/plants-page-header";
import { ListSearchBar } from "@/domains/plants/components/list-searchbar";
import { useSearchbar } from "@/domains/plants/hooks/use-searchbar";
import { filterAndMatchData } from "@/domains/plants/lib/filter-data";
import { DownloadStatus, PlantWithMatch } from "@/domains/plants/types";
import { useDownloadStatus } from "@/domains/plants/hooks/use-download-status";
import { usePlantsDataStore } from "@/domains/plants/store/data-store";
import { usePlantsFilter } from "@/domains/plants/hooks/use-plants-filter";
import { useScrollToTopButton } from "@/domains/plants/hooks/use-scroll-to-top-button";
import { ScrollToTopButton } from "@/domains/plants/components/scroll-to-top-button";
import { ListHeader } from "@/domains/plants/components/list-header";

export default function Index() {
  const { data, fetching } = usePlantsDataStore();
  const { triggerDownload, status } = useDownloadStatus();

  const { listRef, scrollHandler, buttonAnimatedStyle, scrollToTop } =
    useScrollToTopButton<PlantWithMatch>();

  const { searchQuery, debouncedQuery, setSearchQuery, clearQuery } =
    useSearchbar();

  const filteredByText = useMemo(
    () => filterAndMatchData(data, debouncedQuery),
    [data, debouncedQuery],
  );

  const { selectedFilter, setSelectedFilter, filterItems, filteredData } =
    usePlantsFilter(filteredByText);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [selectedFilter, debouncedQuery]);

  const headerOptions = useMemo(
    () => ({
      header: () => (
        <PlantsPageHeader
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
      <ListEmptyState
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
        <ListSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onCleaQuery={clearQuery}
        />
      </View>
      <List
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
