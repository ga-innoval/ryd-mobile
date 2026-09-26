import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { DownloadStatus, PlantWithMatch, Plant } from "@/domains/plants/types";
import { filterAndMatchData } from "@/domains/plants/lib/filter-data";
import { useSearchbar } from "@/domains/plants/hooks/use-searchbar";
import { usePlantsFilter } from "@/domains/plants/hooks/use-plants-filter";
import { usePlantsOrder } from "@/domains/plants/hooks/use-plants-order";
import { useDownloadPlants } from "@/domains/plants/hooks/use-download-plants";
import { useScrollToTopButton } from "@/domains/plants/hooks/use-scroll-to-top-button";
import { usePlants } from "@/domains/plants/hooks/use-plants";
import { haptics } from "@/lib/haptics";
import { PlantsPageHeader } from "@/domains/navigation/plants-page-header";
import { ListEmptyState } from "@/domains/plants/components/list-empty-state";
import { List } from "@/domains/plants/components/list";
import { ListSearchBar } from "@/domains/plants/components/list-searchbar";
import { ScrollToTopButton } from "@/domains/plants/components/scroll-to-top-button";
import { ListHeader } from "@/domains/plants/components/list-header";

const EMPTY_PLANTS: Plant[] = [];

export default function Index() {
  const { data, isLoading, refetch } = usePlants();
  const plants = data ?? EMPTY_PLANTS;

  /**
   * Solo el tirón del usuario enciende la rueda, nunca una recarga de fondo.
   *
   * Antes salía de `isFetching`, que significa "hay una consulta en vuelo" y no
   * "el usuario tiró de la lista". Con eso, guardar una sección invalidaba
   * `["plants"]` y le mandaba al `RefreshControl` un `true` y un `false` en
   * **un milisegundo** —medido—, sin que nadie hubiera tocado la pantalla. El
   * control es nativo y lo conduce el dedo: recibía el `true`, empezaba a montar
   * su animación y el `false` llegaba antes de que terminara, así que el spinner
   * se quedaba dibujado, quieto y para siempre. Intermitente, porque es una
   * carrera contra el ida y vuelta a nativo.
   */
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const handleRefresh = async () => {
    haptics.tap();
    setPullRefreshing(true);

    try {
      await refetch();
    } finally {
      setPullRefreshing(false);
    }
  };

  const { triggerDownload, status, lastDownloadAt } = useDownloadPlants();

  const { listRef, scrollHandler, buttonAnimatedStyle, scrollToTop } =
    useScrollToTopButton<PlantWithMatch>();

  const { searchQuery, debouncedQuery, setSearchQuery, clearQuery } =
    useSearchbar();

  const { orderBy, setOrderBy, direction, toggleDirection, orderedPlants } =
    usePlantsOrder(plants);

  const filteredByText = useMemo(
    () => filterAndMatchData(orderedPlants, debouncedQuery),
    [orderedPlants, debouncedQuery],
  );

  const { selectedFilter, setSelectedFilter, filterItems, filteredData } =
    usePlantsFilter(filteredByText);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [lastDownloadAt, listRef]);

  const headerOptions = useMemo(
    () => ({
      header: () => (
        <PlantsPageHeader
          loadedCount={filteredData.length}
          totalCount={plants.length}
          isLoading={isLoading}
        />
      ),
    }),
    [plants.length, filteredData.length, isLoading],
  );

  const listHeaderComponent = useMemo(
    () => (
      <ListHeader
        filterItems={filterItems}
        selectedFilter={selectedFilter}
        setSelectedFilter={setSelectedFilter}
        orderBy={orderBy}
        setOrderBy={setOrderBy}
        direction={direction}
        toggleDirection={toggleDirection}
      />
    ),
    [
      selectedFilter,
      filterItems,
      orderBy,
      setOrderBy,
      direction,
      toggleDirection,
    ],
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
          onClearQuery={clearQuery}
        />
      </View>
      <List
        ref={listRef}
        data={filteredData}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshing={pullRefreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={emptyStateComponent}
        maintainVisibleContentPosition={{ disabled: true }}
      />

      <ScrollToTopButton onPress={scrollToTop} style={buttonAnimatedStyle} />
    </View>
  );
}
