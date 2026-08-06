import { useMemo, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { Input } from "@/components/ui/input";
import { EvalsEmptyState } from "@/domains/evals/components/evals-lsit-empty-state";
import { EvalsList } from "@/domains/evals/components/evals-list";
import { useDebouncedValue } from "@/domains/evals/hooks/use-debounced-value";
import { filterData } from "@/domains/evals/lib/filter-data";
import { MOCK_EVALS_DATA } from "@/domains/evals/lib/mock-data";
import { EvalsListHeader } from "@/domains/navigation/evals-list-header";

const data = MOCK_EVALS_DATA;

export default function Index() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  const filteredData = useMemo(
    () => filterData(data, debouncedQuery),
    [data, debouncedQuery],
  );

  const headerOptions = useMemo(
    () => ({
      header: () => (
        <EvalsListHeader
          section="Evaluaciones"
          loadedCount={filteredData.length}
          totalCount={data.length}
          hasPendingChanges={true}
          isSyncing={false}
        />
      ),
    }),
    [data.length, filteredData.length],
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={headerOptions} />
      <View className="bg-primary px-6 pb-6">
        <Input
          className="bg-primary-foreground/15 border border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/60"
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel="Buscar evaluaciones"
          placeholder="Buscar variedad, campo o cuadro..."
          keyboardType="web-search"
          autoComplete="off"
          returnKeyType="send"
        />
      </View>
      <EvalsList
        data={filteredData}
        EmptyStateComponent={
          <EvalsEmptyState
            dataLength={data.length}
            searchQuery={searchQuery}
            onClearQuery={() => setSearchQuery("")}
          />
        }
      />
    </View>
  );
}
