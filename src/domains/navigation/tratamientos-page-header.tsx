import { Text } from "@/components/ui/text";
import { HeaderBase } from "./header-base";
import {
  ClearEvaluationButton,
  SaveStatusIndicator,
  SendEvaluationButton,
  SyncStatusIndicator,
} from "./evaluation-save-controls";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/components/ui/icon";
import { ArrowLeft, LeafIcon, SaveIcon } from "lucide-react-native";
import { useAppRouter } from "@/lib/use-app-router";
import { useEvaluationSaveStore } from "@/domains/plants/store/evaluation-save-store";
import { resolveSyncStatus } from "@/domains/plants/lib/sync-status";
import { syncEligibility } from "@/domains/plants/lib/sync-eligibility";
import {
  useItemSendStatus,
  useItemSyncState,
} from "@/domains/plants/hooks/use-item-sync-state";
import { SeparatorLine } from "@/components/ui/separator-line";

interface TratamientosPageHeader {
  /** Hace falta para preguntar qué le queda por enviar a este tratamiento. */
  tratamientoId: string;
  tratamientoName?: string;
  plantName?: string;
  isLoading?: boolean;
}

/**
 * Solo los nombres son skeleton; la estructura del header —fondo, botón de
 * volver, acciones— se monta desde el primer frame para que no haya salto de
 * layout al llegar el dato.
 */
function HeaderDataSkeleton() {
  const pulseStyle = usePulseAnimation({ minOpacity: 0.3 });

  return (
    <Animated.View style={pulseStyle}>
      <View className="flex-row items-center gap-2">
        <View className="h-4 w-28 rounded bg-primary-foreground/20" />
        <Text className="text-primary-foreground/40">/</Text>
        <View className="h-4 w-16 rounded bg-primary-foreground/20" />
      </View>
    </Animated.View>
  );
}

export function TratamientosPageHeader({
  tratamientoId,
  tratamientoName,
  plantName,
  isLoading = false,
}: TratamientosPageHeader) {
  const router = useAppRouter();
  const status = useEvaluationSaveStore((state) => state.status);
  // `null` mientras no haya una evaluación montada detrás: esta cabecera existe
  // desde el primer frame, y hasta entonces no hay nada que guardar.
  const actions = useEvaluationSaveStore((state) => state.actions);

  // **Lo del envío lo lee la cabecera por su cuenta, sin pasar por el store.**
  // El `QueryClientProvider` y el `SQLiteProvider` están por encima del
  // navigator, así que puede consultar aunque se pinte fuera del árbol de la
  // pantalla. El store lleva solo lo que de aquí no se ve.
  const scope = { kind: "tratamiento" as const, tratamientoId };
  const { data: syncState } = useItemSyncState(scope);
  const sendStatus = useItemSendStatus(scope);

  const syncIndicator = resolveSyncStatus({
    send: sendStatus,
    captured: syncState?.captured ?? 0,
    pending: syncState?.pending ?? 0,
    rejected: syncState?.rejected ?? 0,
  });
  const eligibility = syncEligibility({
    pending: syncState?.pending ?? 0,
    hasError: syncState?.hasError ?? false,
  }).kind;

  // **`busy` es solo la escritura local**, no el envío. Bloquear la cabecera
  // entera mientras algo sube dejaría al evaluador atrapado hasta diez segundos
  // —el `timeout` de `apiClient`— sin poder ni volver atrás, y en campo eso es
  // peor que cualquier carrera. Volver y guardar siguen vivos durante el envío;
  // limpiar no, porque borra justo lo que está viajando.
  const busy = status === "saving";
  const sending = sendStatus === "sending";
  const disabled = busy || !actions;

  return (
    <HeaderBase>
      <View className="flex flex-row items-center gap-2">
        <IconButton
          onPress={() => router.back()}
          disabled={busy}
          className="mr-4"
        >
          <Icon size={16} as={ArrowLeft} className="text-white" />
        </IconButton>

        <Icon size={16} as={LeafIcon} className="text-leaf" />

        {isLoading ? (
          <HeaderDataSkeleton />
        ) : plantName && tratamientoName ? (
          <>
            <Text className="text-primary-foreground font-bold">
              {plantName}
            </Text>
            <Text className="text-primary-foreground/40">/</Text>
            <Text className="text-primary-foreground/80 font-medium">
              {tratamientoName}
            </Text>
          </>
        ) : (
          <Text className="text-primary-foreground font-bold">Tratamiento</Text>
        )}
      </View>

      {/* El estado va aquí, junto a las acciones que lo cambian, y no del lado
          de los nombres: lo que se mira antes de tocar «Guardar» es si hace
          falta tocarlo. */}
      <View className="flex-row items-center gap-4">
        <SaveStatusIndicator status={status} />
        <View className="flex-row gap-2">
          <ClearEvaluationButton
            onConfirm={actions?.clear}
            disabled={disabled || sending}
            description="Se borrarán todas las respuestas de este tratamiento y sus fotografías. No se podrán recuperar."
          />
          <IconButton
            onPress={actions?.save}
            disabled={disabled}
            role="button"
            aria-label="Guardar"
          >
            <Icon as={SaveIcon} size={16} className="text-white" />
          </IconButton>
        </View>
        <SeparatorLine />

        {/* Su propio par, con el mismo `gap-2` que el `SyncBlock` de la
            pantalla principal: el estado pegado al botón que lo cambia, igual
            que arriba el de guardado va pegado al suyo. */}
        <View className="flex-row items-center gap-2">
          <SyncStatusIndicator status={syncIndicator} />
          <SendEvaluationButton
            onPress={actions?.send}
            eligibility={eligibility}
            sending={sending}
          />
        </View>
      </View>
    </HeaderBase>
  );
}
