import { Text } from "@/components/ui/text";
import { useSyncStatus } from "../hooks/use-sync-status";
import { formatTimestamp } from "../lib/format-timestamp";
import { SyncStatus } from "../types";
import { StatusDot } from "./status-dot";
import { SyncButton } from "./sync-button";
import { StatusTooltip } from "./status-tooltip";
import { useRef } from "react";
import type { TriggerRef } from "@rn-primitives/tooltip";
import { View } from "react-native";
import { useRelativeTimeLabel } from "../hooks/use-relative-time-label";

interface SyncBlockProps {
  disabled?: boolean;
}

type SyncStatusConfig = {
  dotClassName: string;
  showDot: boolean;
  animated?: boolean;
  label: string;
};

const SYNC_STATUS_CONFIG: Record<SyncStatus, SyncStatusConfig> = {
  [SyncStatus.syncing]: {
    dotClassName: "bg-blue-400",
    showDot: true,
    animated: true,
    label: "Sincronizando...",
  },
  [SyncStatus.synced]: {
    dotClassName: "bg-leaf",
    showDot: true,
    label: "Sincronizado",
  },
  [SyncStatus.unsynced]: {
    dotClassName: "bg-muted/30",
    showDot: true,
    label: "Sin sincronizar",
  },
  [SyncStatus.error]: {
    dotClassName: "bg-destructive",
    showDot: true,
    label: "Error de sincronización",
  },
  [SyncStatus.pending]: {
    dotClassName: "bg-orange-400",
    showDot: true,
    animated: true,
    label: "Sinc. pendiente",
  },
  [SyncStatus.rejected_closed]: {
    dotClassName: "bg-destructive",
    showDot: true,
    label: "Sincronización rechazada",
  },
};

export function SyncBlock({ disabled }: SyncBlockProps) {
  const { status, pendingCount, lastSyncedAt, triggerSync } = useSyncStatus();
  const { label: lastSyncedAtLabel, refresh: refreshLastSyncedAtLabel } =
    useRelativeTimeLabel(
      lastSyncedAt,
      (ts) => `Últ. sincronización ${formatTimestamp(ts)}`,
    );

  const {
    dotClassName,
    showDot,
    animated = false,
    label,
  } = SYNC_STATUS_CONFIG[status];

  const triggerRef = useRef<TriggerRef>(null);
  const isSyncing = status === SyncStatus.syncing;

  const showSyncedTooltip = status === SyncStatus.synced;

  const handleTooltipOpenChange = (open: boolean) => {
    if (open) refreshLastSyncedAtLabel();
  };

  return (
    <View className="flex-row items-center gap-2">
      {showSyncedTooltip ? (
        <StatusTooltip
          onOpenChange={handleTooltipOpenChange}
          triggerRef={triggerRef}
          label={lastSyncedAtLabel}
        >
          <StatusDot dotClassName={dotClassName} animated={false} visible />
          <Text className="text-primary-foreground/80 text-sm">{label}</Text>
        </StatusTooltip>
      ) : (
        <View className="flex-row items-center gap-1.5">
          <StatusDot
            dotClassName={dotClassName}
            animated={true}
            visible={showDot && animated}
          />
          <StatusDot
            dotClassName={dotClassName}
            animated={false}
            visible={showDot && !animated}
          />
          <Text className="text-primary-foreground/80 text-sm">{label}</Text>
        </View>
      )}

      {/* Apagado sin nada que mandar, igual que el botón de cada pantalla de
          captura: pulsarlo entonces solo dejaría un aviso diciendo que no salió
          nada. Lo bloqueado por un dato imposible **sí** cuenta como pendiente,
          así que el botón sigue encendido y el aviso explica por qué no salió. */}
      <SyncButton
        loading={isSyncing}
        onPress={triggerSync}
        disabled={disabled || pendingCount === 0}
      />
    </View>
  );
}
