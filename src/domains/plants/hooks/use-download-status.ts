import { DownloadStatus } from "../types";
import { useDownloadStore } from "../store/download-store";
import { useDownloadPlants } from "./use-download-plants";

export function useDownloadStatus() {
  const lastDownloadAt = useDownloadStore((s) => s.lastDownloadAt);
  const mutation = useDownloadPlants();

  // TODO: cuando se implemente el chequeo proactivo de cambios en servidor
  // (endpoint tipo HEAD /plantaciones/status?since=...),
  // este valor vendrá de una query aparte, ej. usePendingRemoteChanges().
  const pendingCount = 0;

  const getStatus = (): DownloadStatus => {
    if (mutation.isPending) return DownloadStatus.downloading;
    if (mutation.isError) return DownloadStatus.error;
    if (pendingCount > 0) return DownloadStatus.pending;
    if (!lastDownloadAt) return DownloadStatus.notDownloaded;
    return DownloadStatus.downloaded;
  };

  return {
    status: getStatus(),
    lastDownloadAt,
    lastDownloadError: mutation.error?.message ?? null,
    triggerDownload: mutation.mutate,
  };
}
