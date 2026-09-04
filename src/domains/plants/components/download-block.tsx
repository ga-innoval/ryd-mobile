import { View } from "react-native";
import { CloudDownloadIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { StatusDot } from "./status-dot";
import { useDownloadPlants } from "../hooks/use-download-plants";
import { DownloadStatus } from "../types";
import { StatusTooltip } from "./status-tooltip";
import { useNotiTooltip } from "../hooks/use-noti-tooltip";
import { formatTimestamp } from "../lib/format-timestamp";
import { useRelativeTimeLabel } from "../hooks/use-relative-time-label";

type DownloadStatusConfig = {
  dotClassName: string;
  showDot: boolean;
  animated?: boolean;
  label?: string;
};

const DOWNLOAD_STATUS_CONFIG: Record<DownloadStatus, DownloadStatusConfig> = {
  [DownloadStatus.downloading]: {
    dotClassName: "bg-blue-400",
    showDot: true,
    animated: true,
    label: "Descargando...",
  },
  [DownloadStatus.downloaded]: {
    dotClassName: "bg-green-500",
    showDot: false,
  },
  [DownloadStatus.notDownloaded]: {
    dotClassName: "bg-muted/30",
    showDot: false,
    label: "Sin descargar",
  },
  [DownloadStatus.error]: {
    dotClassName: "bg-red-400",
    showDot: true,
    label: "Error de descarga",
  },
  [DownloadStatus.pending]: {
    dotClassName: "bg-orange-400",
    showDot: true,
    animated: true,
  },
};

interface DownloadBlockProps {
  totalCount: number;
  loadedCount?: number;
  isLoading?: boolean;
}

export function DownloadBlock({
  totalCount,
  loadedCount = 0,
  isLoading = false,
}: DownloadBlockProps) {
  const { status, triggerDownload, lastDownloadAt, pendingCount } =
    useDownloadPlants();
  const {
    triggerRef,
    open: openTooltip,
    close: closeTooltip,
  } = useNotiTooltip();

  const {
    dotClassName,
    showDot,
    animated = false,
    label,
  } = DOWNLOAD_STATUS_CONFIG[status];

  const {
    label: lastDownloadedAtLabel,
    refresh: refreshLastDownloadedAtLabel,
  } = useRelativeTimeLabel(
    lastDownloadAt,
    (ts) => `Últ. descarga ${formatTimestamp(ts)}`,
  );
  const dynamicLabel: Partial<Record<DownloadStatus, string>> = {
    [DownloadStatus.downloaded]: lastDownloadedAtLabel,
    [DownloadStatus.pending]: `Cambios por descargar (${pendingCount})`,
  };

  const statusLabel = dynamicLabel[status] ?? label ?? "";

  const handleTooltipOpenChange = (open: boolean) => {
    if (open && status === DownloadStatus.downloaded) {
      refreshLastDownloadedAtLabel();
    }
  };

  const isDownloading = status === DownloadStatus.downloading;

  const handleDownload = () => {
    openTooltip();
    triggerDownload({ onSettled: closeTooltip });
  };

  return (
    <View className="flex-row items-center gap-2">
      <StatusTooltip
        triggerRef={triggerRef}
        onOpenChange={handleTooltipOpenChange}
        label={statusLabel}
      >
        <StatusDot
          dotClassName={dotClassName}
          animated={animated}
          visible={showDot}
        />
        <Text className="text-primary-foreground/80 text-sm">
          {isLoading
            ? "Obteniendo plantaciones..."
            : `${loadedCount} de ${totalCount} plantaciones`}
        </Text>
      </StatusTooltip>

      <IconButton
        disabled={isDownloading}
        accessibilityRole="button"
        accessibilityLabel="Descargar plantaciones"
        onPress={handleDownload}
      >
        <Icon
          as={CloudDownloadIcon}
          size={16}
          className="text-primary-foreground"
        />
      </IconButton>
    </View>
  );
}
