import { Text } from "@/components/ui/text";
import { useSyncStatus } from "../hooks/use-sync-status";
import { formatTimestamp } from "../lib/format-timestamp";
import { SyncStatus } from "../types";
import { StatusDot } from "./status-dot";
import { SyncButton } from "./sync-button";
import { StatusTooltip } from "./status-tooltip";
import { useCallback, useRef, useState } from "react";
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
    dotClassName: "bg-green-500",
    showDot: true,
    label: "Sincronizado",
  },
  [SyncStatus.unsynced]: {
    dotClassName: "bg-muted/30",
    showDot: true,
    label: "Sin sincronizar",
  },
  [SyncStatus.error]: {
    dotClassName: "bg-red-400",
    showDot: true,
    label: "Error de sincronización",
  },
  [SyncStatus.pending]: {
    dotClassName: "bg-orange-400",
    showDot: true,
    animated: true,
    label: "Sincronización pendiente",
  },
  [SyncStatus.rejected_closed]: {
    dotClassName: "bg-red-400",
    showDot: true,
    label: "Sincronización rechazada",
  },
};

export function SyncBlock({ disabled }: SyncBlockProps) {
  const { status, lastSyncedAt, triggerSync } = useSyncStatus();
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
    <>
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

      <SyncButton
        loading={isSyncing}
        onPress={triggerSync}
        disabled={disabled}
      />
    </>
  );
}
