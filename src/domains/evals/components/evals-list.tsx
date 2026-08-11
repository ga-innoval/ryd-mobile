import { Text } from "@/components/ui/text";
import { memo, ReactElement, type ReactNode, useCallback } from "react";
import { ScrollView, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Icon } from "@/components/ui/icon";
import {
  BoxIcon,
  ChevronRight,
  LeafIcon,
  LucideIcon,
} from "lucide-react-native";
import { cn } from "@/lib/utils";
import { EVALS_POST_COSECHA } from "../lib/evals-post-cosecha";
import { SyncStatus, type Evaluacion } from "../types";
import { Badge } from "@/components/ui/badge";

const DATA_FIELD_CONFIG: {
  label: string;
  key: Exclude<keyof Evaluacion, "tratamientos" | "progress" | "syncStatus">;
}[] = [
  { label: "Campo", key: "campo" },
  { label: "Cuadro", key: "cuadro" },
  { label: "Programa", key: "programa" },
  { label: "Patrón", key: "patron" },
  { label: "Año", key: "anio" },
];

const DataField = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <View className="flex-row gap-2 items-center">
    <Text variant="muted">{label}</Text>
    <Text className="font-medium">{value}</Text>
  </View>
);

type CardSectionVariant = "outlined" | "secondary";

const SECTION_VARIANT_STYLES: Record<CardSectionVariant, string> = {
  outlined: "border-y border-border bg-background",
  secondary: "bg-secondary",
};

export const CardRecordSection = ({
  icon,
  label,
  variant,
  children,
}: {
  icon: LucideIcon;
  label: string;
  variant: CardSectionVariant;
  children: ReactNode;
}) => {
  return (
    <View
      className={cn(
        "flex-row h-24 px-6 items-center",
        SECTION_VARIANT_STYLES[variant],
      )}
    >
      <View className="flex-row items-center gap-2 w-36">
        <Icon as={icon} />
        <Text className="font-medium uppercase">{label}</Text>
      </View>
      <ScrollView
        showsHorizontalScrollIndicator={false}
        horizontal
        className="ml-4 -mr-6"
        contentContainerClassName="gap-4 flex-grow pr-6"
      >
        {children}
      </ScrollView>
    </View>
  );
};

const CardHeader = ({ item }: { item: Evaluacion }) => {
  return (
    <View className="flex-row justify-between items-center pr-6">
      <View className="px-6 py-6 gap-2">
        <View className="flex-row gap-2">
          <Text variant="large">{item.name}</Text>
          <Badge variant={item.progress === 0 ? "secondary" : "success"}>
            <Text>
              {item.progress === 0
                ? "Sin iniciar "
                : `${item.progress * 100}% completado`}
            </Text>
          </Badge>
          {item.syncStatus === SyncStatus.PEN && (
            <Badge className="bg-orange-300/20 border-orange-300 gap-1">
              <View className="rounded-full bg-orange-400 h-1.5 w-1.5" />
              <Text className="text-orange-600 font-medium">Pendiente</Text>
            </Badge>
          )}
        </View>
        <View className="flex-row flex-wrap gap-6">
          {DATA_FIELD_CONFIG.map(({ label, key }) => (
            <DataField key={key} label={label} value={item[key]} />
          ))}
        </View>
      </View>
      <Icon size={20} as={ChevronRight} />
    </View>
  );
};

export const EvaluacionCard = memo(function EvaluacionCard({
  item,
}: {
  item: Evaluacion;
}) {
  return (
    <View className="rounded-xl bg-card shadow-md shadow-black/5">
      <View className="rounded-xl border-2 border-border overflow-hidden">
        <CardHeader item={item} />
        <CardRecordSection
          icon={LeafIcon}
          label="tratamiento"
          variant="outlined"
        >
          {item.tratamientos.map((trat, index) => (
            <View
              key={trat.name + index}
              className="w-16 h-16 rounded-xl items-center justify-center border-2 border-border"
            >
              <Text className="font-medium">{index + 1}</Text>
            </View>
          ))}
          {item.tratamientos.length === 0 && (
            <Text variant="muted">Sin tratamientos configurados</Text>
          )}
        </CardRecordSection>
        <CardRecordSection
          icon={BoxIcon}
          label="post cosecha"
          variant="secondary"
        >
          {EVALS_POST_COSECHA.map(({ id, title, subtitle }) => (
            <View
              key={id}
              testID={`post-cosecha-${id}`}
              className="rounded-xl border-2 border-border py-2 p-6 items-center"
            >
              <Text className="font-medium">{title}</Text>
              <Text variant="muted">{subtitle}</Text>
            </View>
          ))}
        </CardRecordSection>
      </View>
    </View>
  );
});

export const EvalsList = ({
  data,
  EmptyStateComponent,
}: {
  data: Evaluacion[];
  EmptyStateComponent?: ReactElement;
}) => {
  const renderItem = useCallback(
    ({ item }: { item: Evaluacion }) => <EvaluacionCard item={item} />,
    [],
  );
  const renderItemSeparator = useCallback(() => <View className="h-4" />, []);

  return (
    <FlashList
      contentContainerClassName="p-6 pb-10"
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      data={data}
      ItemSeparatorComponent={renderItemSeparator}
      ListEmptyComponent={EmptyStateComponent}
    />
  );
};
