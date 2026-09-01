import { useIsMutating } from "@tanstack/react-query";
import { DownloadStatus } from "../types";
import { useDownloadStore } from "../store/download-store";
import {
  usePlantsMutation,
  PLANTS_DOWNLOAD_MUTATION_KEY,
} from "./use-plants-mutation";
import { haptics } from "@/lib/haptics";

type TriggerDownloadOptions = Parameters<
  ReturnType<typeof usePlantsMutation>["mutate"]
>[1];

export function useDownloadPlants() {
  const lastDownloadAt = useDownloadStore((s) => s.lastDownloadAt);
  const mutation = usePlantsMutation();

  // Se lee de la cache y no de `mutation.isPending` porque este hook se
  // instancia por separado en la lista y en el header: cada `useMutation`
  // crea su propio observer y ninguno vería la descarga disparada por el
  // otro, permitiendo dos descargas concurrentes.
  const isDownloading =
    useIsMutating({ mutationKey: PLANTS_DOWNLOAD_MUTATION_KEY }) > 0;

  // TODO: cuando se implemente el chequeo proactivo de cambios en servidor
  // (endpoint tipo HEAD /plantaciones/status?since=...),
  // este valor vendrá de una query aparte, ej. usePendingRemoteChanges().
  const pendingCount = 0;

  const getStatus = (): DownloadStatus => {
    if (isDownloading) return DownloadStatus.downloading;
    if (mutation.isError) return DownloadStatus.error;
    if (pendingCount > 0) return DownloadStatus.pending;
    if (!lastDownloadAt) return DownloadStatus.notDownloaded;
    return DownloadStatus.downloaded;
  };

  const triggerDownload = (options?: TriggerDownloadOptions) => {
    haptics.tap();
    mutation.mutate(undefined, options);
  };

  return {
    status: getStatus(),
    lastDownloadAt,
    lastDownloadError: mutation.error?.message ?? null,
    triggerDownload,
  };
}
