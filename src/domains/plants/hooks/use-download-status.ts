import { DownloadStatus } from "../types";
import { useDownloadStore } from "../store/download-store";

export function useDownloadStatus() {
  const { isDownloading, lastDownloadAt, lastDownloadError, triggerDownload } =
    useDownloadStore();

  const pendingCount = 0;

  const getStatus = (): DownloadStatus => {
    if (isDownloading) return DownloadStatus.downloading;
    if (lastDownloadError) return DownloadStatus.error;
    if (pendingCount > 0) return DownloadStatus.pending;
    if (!lastDownloadAt) return DownloadStatus.notDownloaded;
    return DownloadStatus.downloaded;
  };

  return { status: getStatus(), lastDownloadAt, triggerDownload };
}
