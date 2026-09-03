import { DownloadStatus } from "../types";

type DownloadStatusInput = {
  isDownloading: boolean;
  hasError: boolean;
  pendingCount: number;
  lastDownloadAt: number | null;
};

export const getDownloadStatus = ({
  isDownloading,
  hasError,
  pendingCount,
  lastDownloadAt,
}: DownloadStatusInput): DownloadStatus => {
  if (isDownloading) return DownloadStatus.downloading;
  if (hasError) return DownloadStatus.error;
  if (pendingCount > 0) return DownloadStatus.pending;
  if (!lastDownloadAt) return DownloadStatus.notDownloaded;
  return DownloadStatus.downloaded;
};
