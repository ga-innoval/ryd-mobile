import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { DownloadStatus, PlantWithMatch, Plant } from "@/domains/plants/types";
import { filterAndMatchData } from "@/domains/plants/lib/filter-data";
import { useSearchbar } from "@/domains/plants/hooks/use-searchbar";
import { usePlantsFilter } from "@/domains/plants/hooks/use-plants-filter";
import { useDownloadStatus } from "@/domains/plants/hooks/use-download-status";
import { useScrollToTopButton } from "@/domains/plants/hooks/use-scroll-to-top-button";
import { usePlants } from "@/domains/plants/hooks/use-plants";
import { PlantsPageHeader } from "@/domains/navigation/plants-page-header";
import { ListEmptyState } from "@/domains/plants/components/list-empty-state";
import { List } from "@/domains/plants/components/list";
import { ListSearchBar } from "@/domains/plants/components/list-searchbar";
import { ScrollToTopButton } from "@/domains/plants/components/scroll-to-top-button";
import { ListHeader } from "@/domains/plants/components/list-header";

const EMPTY_PLANTS: Plant[] = [];

export default function Index() {
  const { data, isLoading, isFetching, refetch } = usePlants();
  const plants = data
    ? // TODO: Tratamientos se obtendrán de la api y progreso sobre el avance de las encuestas
      data.map((item) => ({ ...item, tratamientos: [], progress: 0 }))
    : EMPTY_PLANTS;

  // fetching real pero NO la primera carga (esa la cubre isLoading/skeleton)
  const isRefreshing = isFetching && !isLoading;

  const { triggerDownload, status } = useDownloadStatus();

  const { listRef, scrollHandler, buttonAnimatedStyle, scrollToTop } =
    useScrollToTopButton<PlantWithMatch>();

  const { searchQuery, debouncedQuery, setSearchQuery, clearQuery } =
    useSearchbar();

  const filteredByText = useMemo(
    () => filterAndMatchData(plants, debouncedQuery),
    [plants, debouncedQuery],
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
          totalCount={plants.length}
        />
      ),
    }),
    [plants.length, filteredData.length],
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
        isLoading={isLoading}
        dataLength={plants.length}
        searchQuery={debouncedQuery}
        onClearQuery={clearQuery}
        onDownloadData={triggerDownload}
        downloading={status === DownloadStatus.downloading}
      />
    ),
    [
      isLoading,
      plants.length,
      debouncedQuery,
      clearQuery,
      triggerDownload,
      status,
    ],
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
        refreshing={isRefreshing}
        onRefresh={refetch}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={emptyStateComponent}
      />

      <ScrollToTopButton onPress={scrollToTop} style={buttonAnimatedStyle} />
    </View>
  );
}
