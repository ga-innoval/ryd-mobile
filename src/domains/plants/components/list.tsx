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
import { useAppRouter } from "@/lib/use-app-router";
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
import { PressableScale } from "@/components/ui/pressable-scale";
import { TratamientoChip } from "./tratamiento-chip";

const DATA_FIELD_CONFIG: {
  label: string;
  key: MatchableField;
  valueCn: string;
}[] = [
  { label: "Campo", key: "campo", valueCn: "capitalize" },
  { label: "Cuadro", key: "cuadro", valueCn: "uppercase" },
  { label: "Programa", key: "programa", valueCn: "uppercase" },
  { label: "Patrón", key: "portainjerto", valueCn: "capitalize" },
  { label: "Año", key: "anio", valueCn: "" },
];

const DataField = ({
  label,
  value,
  match,
  valueCn,
}: {
  label: string;
  value: string | number;
  match?: FieldMatch;
  valueCn: string;
}) => (
  <View className="flex-row gap-2 items-center">
    <Text variant="muted">{label}</Text>
    <HighlightedText
      className={cn("font-medium", valueCn)}
      text={String(value).toLocaleLowerCase()}
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
          {/* Después del de estatus y sin sustituirlo: una plantación iniciada
              también puede traer un dato inválido. */}
          {item.tratamientosWithError.length > 0 && (
            <Badge className="bg-destructive-background border-destructive/30 gap-1">
              <Text className="text-destructive font-medium">
                Error de captura
              </Text>
            </Badge>
          )}
          {item.syncStatus === SyncStatus.pending && (
            <Badge className="bg-orange-300/20 border-orange-300 gap-1">
              <View className="rounded-full bg-orange-400 h-1.5 w-1.5" />
              <Text className="text-orange-600 font-medium">Pendiente</Text>
            </Badge>
          )}
        </View>
        <View className="flex-row flex-wrap gap-4">
          {DATA_FIELD_CONFIG.map(({ label, key, valueCn }) => (
            <DataField
              key={key}
              label={label}
              value={item[key]}
              valueCn={valueCn}
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
  const router = useAppRouter();

  return (
    <View className="rounded-xl bg-card shadow-md shadow-black/5">
      <View className="rounded-xl border-2 border-border">
        {/* Las secciones se recortan al radio **interior** del borde —el 10
            es `rounded-xl` (12) menos `border-2` (2)— y no al de fuera. El
            fondo de la última (post-cosecha) tiene esquinas rectas: recortado
            al radio de fuera se metía en la franja curva del borde, y como el
            borde es translúcido las esquinas de abajo salían más oscuras en
            iOS (el borde va delante del contenido) y más claras en Android
            (el verde lo tapa). Recortando aquí, bajo el borde queda siempre el
            blanco de la tarjeta, sea cual sea la sección que toque abajo. El
            porqué completo está en la cabecera de `collapsible-section.tsx`. */}
        <View className="overflow-hidden rounded-[10px]">
          <CardHeader item={item} match={match} />
          <CardRecordSection
            icon={LeafIcon}
            label="tratamiento"
            variant="outlined"
          >
            {item.tratamientos.map((trat) => (
              // Desde la tarjeta se entra al detalle: `push`.
              <TratamientoChip
                key={trat.id}
                tratamiento={trat}
                hasError={item.tratamientosWithError.includes(trat.id)}
                progress={trat.progress}
                onPress={() =>
                  router.push({
                    pathname: "/tratamientos/[id]",
                    params: { id: trat.id },
                  })
                }
              />
            ))}
            {item.tratamientos.length === 0 && (
              <Text variant="muted">Sin tratamientos configurados</Text>
            )}
          </CardRecordSection>
          <CardRecordSection
            icon={BoxIcon}
            label="post-cosecha"
            variant="secondary"
          >
            {EVALS_POST_COSECHA.map(({ id, title, subtitle }) => (
              // TODO: navegar al formulario de post-cosecha cuando exista su
              // ruta. De momento solo da el feedback táctil.
              <PressableScale
                key={id}
                testID={`post-cosecha-${id}`}
                className="w-28 rounded-xl border-2 border-border py-2 items-center"
              >
                <Text className="font-medium">{title}</Text>
                <Text variant="muted">{subtitle}</Text>
              </PressableScale>
            ))}
          </CardRecordSection>
        </View>
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
      maintainVisibleContentPosition={{ disabled: true }}
      data={data}
      {...props}
    />
  );
});

List.displayName = "List";
