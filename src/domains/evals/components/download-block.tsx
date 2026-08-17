import { CloudDownloadIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { StatusDot } from "./status-dot";
import { useDownloadStatus } from "../hooks/use-download-status";
import { DownloadStatus } from "../types";
import { StatusTooltip } from "./status-tooltip";
import { useNotiTooltip } from "../hooks/use-noti-tooltip";
import { formatTimestamp } from "../lib/format-timestamp";
import { useRelativeTimeLabel } from "../hooks/use-relative-time-label";

type DownloadStatusConfig = {
  dotClassName: string;
  showDot: boolean;
  animated?: boolean;
  label: string;
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
    label: "",
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
    label: "Descarga pendiente",
  },
};

interface DownloadBlockProps {
  totalCount: number;
  loadedCount?: number;
}

export function DownloadBlock({
  totalCount,
  loadedCount = 0,
}: DownloadBlockProps) {
  const { status, triggerDownload, lastDownloadAt } = useDownloadStatus();
  const { triggerRef, noti, showNoti } = useNotiTooltip();

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
  const statusLabel =
    status === DownloadStatus.downloaded ? lastDownloadedAtLabel : label;

  const handleTooltipOpenChange = (open: boolean) => {
    if (open && status === DownloadStatus.downloaded) {
      refreshLastDownloadedAtLabel();
    }
  };

  const isDownloading = status === DownloadStatus.downloading;

  const handleDownload = () => {
    triggerRef.current?.open();
    triggerDownload({
      onSuccess: () => showNoti("¡Listo!"),
      onError: () => showNoti("Error al descargar"),
    });
  };

  return (
    <>
      <StatusTooltip
        triggerRef={triggerRef}
        onOpenChange={handleTooltipOpenChange}
        label={noti ?? statusLabel}
      >
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
        <Text className="text-primary-foreground/80 text-sm">
          {loadedCount} de {totalCount} plantaciones
        </Text>
      </StatusTooltip>

      <IconButton
        disabled={isDownloading}
        accessibilityRole="button"
        accessibilityLabel="Descargar evaluaciones"
        onPress={handleDownload}
      >
        <Icon
          as={CloudDownloadIcon}
          size={16}
          className="text-primary-foreground"
        />
      </IconButton>
    </>
  );
}
