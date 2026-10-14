import { View } from "react-native";
import Animated from "react-native-reanimated";
import { ArrowLeft, LeafIcon, SaveIcon } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { usePulseAnimation } from "@/lib/use-pulse-animation";
import { useAppRouter } from "@/lib/use-app-router";
import { HeaderBase } from "./header-base";
import {
  ClearEvaluationButton,
  SaveStatusIndicator,
  SendEvaluationButton,
  SyncStatusIndicator,
} from "./evaluation-save-controls";
import { useEvaluationSaveStore } from "@/domains/plants/store/evaluation-save-store";
import { resolveSyncStatus } from "@/domains/plants/lib/sync-status";
import {
  hasSyncedWork,
  syncEligibility,
} from "@/domains/plants/lib/sync-eligibility";
import {
  useItemSendStatus,
  useItemSyncState,
} from "@/domains/plants/hooks/use-item-sync-state";
import { SeparatorLine } from "@/components/ui/separator-line";

type PostcosechaPageHeaderProps = {
  /** La plantación y cuál de las cuatro: hace falta para preguntar qué le queda
   *  por enviar a **esta** evaluación, no a las cuatro. */
  plantId: string;
  evalId: string;
  plantName?: string;
  /** Los días y el empaque de la evaluación abierta, ya compuestos. */
  evalName?: string;
  isLoading?: boolean;
};

/** Solo los nombres son skeleton; la estructura del header se monta desde el
 *  primer frame para que no haya salto de layout al llegar el dato. */
function HeaderDataSkeleton() {
  const pulseStyle = usePulseAnimation({ minOpacity: 0.3 });

  return (
    <Animated.View style={pulseStyle}>
      <View className="flex-row items-center gap-2">
        <View className="h-4 w-28 rounded bg-primary-foreground/20" />
        <Text className="text-primary-foreground/40">/</Text>
        <View className="h-4 w-24 rounded bg-primary-foreground/20" />
      </View>
    </Animated.View>
  );
}

/**
 * La cabecera de una evaluación de post-cosecha.
 *
 * Hermana de `TratamientosPageHeader` y con la misma forma a propósito: son la
 * misma tarea en dos sitios y leerse igual es parte de que se entiendan. Lo que
 * cambia es qué va después de la plantación — allí el tratamiento, aquí los
 * días y el empaque.
 *
 * Comparte con ella el estado de guardado y los dos botones, que salen del
 * mismo store: solo hay una pantalla de captura abierta a la vez, así que no
 * hace falta que el store sepa de quién es lo que cuenta.
 */
export function PostcosechaPageHeader({
  plantId,
  evalId,
  plantName,
  evalName,
  isLoading = false,
}: PostcosechaPageHeaderProps) {
  const router = useAppRouter();
  const status = useEvaluationSaveStore((state) => state.status);
  // `null` mientras no haya una evaluación montada detrás: esta cabecera existe
  // desde el primer frame, y hasta entonces no hay nada que guardar.
  const actions = useEvaluationSaveStore((state) => state.actions);

  // Lo del envío lo lee la cabecera por su cuenta, sin pasar por el store: los
  // proveedores de SQLite y de la caché están por encima del navigator.
  const scope = { kind: "postcosecha" as const, plantId, evalId };
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

  // **Limpiar se apaga en cuanto el servidor tenga algo.** Es el único control
  // de la cabecera que destruye trabajo, y sin lápida lo borrado seguiría vivo
  // en el reporte. Se apaga y no se oculta para que la cabecera no cambie de
  // forma entre una captura y otra. Mientras SQLite no conteste está encendido,
  // que es lo correcto en el caso de siempre: una captura a la que no le falta
  // nada por mandar es la excepción, no la regla.
  const limpiable = !hasSyncedWork({
    captured: syncState?.captured ?? 0,
    pending: syncState?.pending ?? 0,
    rejected: syncState?.rejected ?? 0,
  });

  // `busy` es solo la escritura local, no el envío: bloquear la cabecera entera
  // mientras algo sube dejaría al evaluador atrapado hasta diez segundos sin
  // poder ni volver atrás. Limpiar sí se apaga, porque borra lo que viaja.
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
        ) : plantName && evalName ? (
          <>
            <Text className="text-primary-foreground font-bold">
              {plantName}
            </Text>
            <Text className="text-primary-foreground/40">/</Text>
            <Text className="text-primary-foreground/80 font-medium">
              {evalName}
            </Text>
          </>
        ) : (
          <Text className="text-primary-foreground font-bold">
            Post-cosecha
          </Text>
        )}
      </View>

      {/* El estado va aquí, junto a las acciones que lo cambian, y no del lado
          de los nombres: lo que se mira antes de tocar «Guardar» es si hace
          falta tocarlo. */}
      <View className="flex-row items-center gap-4">
        <SaveStatusIndicator status={status} />
        <View className="flex-row gap-2">
          {/* Nombra la evaluación: las cuatro se ven casi iguales y con los
              chips es fácil estar en la que no es. */}
          <ClearEvaluationButton
            onConfirm={actions?.clear}
            disabled={disabled || sending || !limpiable}
            description={`Se borrarán todas las respuestas de esta evaluación${
              evalName ? ` (${evalName})` : ""
            } y sus fotografías. No se podrán recuperar.`}
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
