import {
  forwardRef,
  memo,
  ReactElement,
  type ReactNode,
  useCallback,
} from "react";
import Animated from "react-native-reanimated";
import { ScrollView, View } from "react-native";
import { FlashList, FlashListProps, FlashListRef } from "@shopify/flash-list";
import { BoxIcon, LeafIcon, LucideIcon } from "lucide-react-native";
import {
  type PlantWithMatch,
  type FieldMatch,
  type MatchableField,
  type Plant,
  SyncStatus,
} from "../types";
import { cn } from "@/lib/utils";

import { EVALS_POST_COSECHA } from "../lib/evals-post-cosecha";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { HighlightedText } from "@/components/highlighted-text";
import { Separator } from "@/components/ui/separator";

const DATA_FIELD_CONFIG: {
  label: string;
  key: MatchableField;
}[] = [
  { label: "Campo", key: "campo" },
  { label: "Cuadro", key: "cuadro" },
  { label: "Programa", key: "programa" },
  { label: "Patrón", key: "portainjerto" },
  { label: "Año", key: "anio" },
];

const DataField = ({
  label,
  value,
  match,
}: {
  label: string;
  value: string | number;
  match?: FieldMatch;
}) => (
  <View className="flex-row gap-2 items-center">
    <Text variant="muted">{label}</Text>
    <HighlightedText
      className="font-medium"
      text={String(value)}
      match={match}
    />
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
        "flex-row h-24 px-4 items-center",
        SECTION_VARIANT_STYLES[variant],
      )}
    >
      <View className="flex-row items-center gap-1 w-36">
        <Icon as={icon} />
        <Text variant="small" className="font-medium uppercase">
          {label}
        </Text>
      </View>
      <Separator orientation="vertical" decorative className="h-16 -ml-1" />
      <ScrollView
        showsHorizontalScrollIndicator={false}
        horizontal
        className="-mr-6"
        contentContainerClassName="gap-4 flex-grow pl-4 pr-6"
      >
        {children}
      </ScrollView>
    </View>
  );
};

const CardHeader = ({ item, match }: { item: Plant; match?: FieldMatch }) => {
  return (
    <View className="flex-row justify-between items-center pr-6">
      <View className="px-4 py-4 gap-2">
        <View className="flex-row gap-2">
          <HighlightedText
            variant="large"
            text={item.name}
            match={match?.field === "name" ? match : undefined}
          />
          <Badge variant={item.progress === 0 ? "secondary" : "success"}>
            <Text>
              {item.progress === 0
                ? "Sin iniciar "
                : `${item.progress * 100}% completado`}
            </Text>
          </Badge>
          {item.syncStatus === SyncStatus.pending && (
            <Badge className="bg-orange-300/20 border-orange-300 gap-1">
              <View className="rounded-full bg-orange-400 h-1.5 w-1.5" />
              <Text className="text-orange-600 font-medium">Pendiente</Text>
            </Badge>
          )}
        </View>
        <View className="flex-row flex-wrap gap-4">
          {DATA_FIELD_CONFIG.map(({ label, key }) => (
            <DataField
              key={key}
              label={label}
              value={item[key]}
              match={match?.field === key ? match : undefined}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

export const PlantCard = memo(function PlantCard({
  item,
  match,
}: {
  item: Plant;
  match?: FieldMatch;
}) {
  return (
    <View className="rounded-xl bg-card shadow-md shadow-black/5">
      <View className="rounded-xl border-2 border-border overflow-hidden">
        <CardHeader item={item} match={match} />
        <CardRecordSection
          icon={LeafIcon}
          label="tratamiento"
          variant="outlined"
        >
          {item.tratamientos.map((trat, index) => (
            <View
              key={trat.name + index}
              className="w-28 h-16 rounded-xl items-center justify-center border-2 border-border flex-row relative overflow-hidden"
            >
              <Text numberOfLines={1} className="font-medium max-w-24">
                {trat.name}
              </Text>
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
              className="w-28 rounded-xl border-2 border-border py-2 items-center"
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

// Animated.createAnimatedComponent no preserva el genérico de FlashList<T>,
// por eso el cast explícito del tipo del componente resultante.
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as <T>(
  props: FlashListProps<T> & { ref?: React.Ref<FlashListRef<T>> },
) => ReactElement;

export const List = forwardRef<
  FlashListRef<PlantWithMatch>,
  Omit<FlashListProps<PlantWithMatch>, "renderItem">
>(({ data, ...props }, ref) => {
  const renderItem = useCallback(
    ({ item }: { item: PlantWithMatch }) => (
      <PlantCard item={item.plantItem} match={item.match} />
    ),
    [],
  );
  const renderItemSeparator = useCallback(() => <View className="h-4" />, []);

  return (
    <AnimatedFlashList
      ref={ref}
      contentContainerClassName="px-4 pb-10"
      renderItem={renderItem}
      keyExtractor={(item) => item.plantItem.id}
      ItemSeparatorComponent={renderItemSeparator}
      data={data}
      {...props}
    />
  );
});

List.displayName = "List";
