import { useIsMutating } from "@tanstack/react-query";
import { useDownloadStore } from "../store/download-store";
import {
  usePlantsMutation,
  PLANTS_DOWNLOAD_MUTATION_KEY,
} from "./use-plants-mutation";
import { usePendingPlants } from "./use-pending-plants";
import { getDownloadStatus } from "../lib/get-download-status";
import { haptics } from "@/lib/haptics";

type TriggerDownloadOptions = Parameters<
  ReturnType<typeof usePlantsMutation>["mutate"]
>[1];

export function useDownloadPlants() {
  const lastDownloadAt = useDownloadStore((s) => s.lastDownloadAt);
  const mutation = usePlantsMutation();

  // Se lee de la cache y no de `mutation.isPending` porque este hook se
  // instancia por separado en la lista y en el header
  const isDownloading =
    useIsMutating({ mutationKey: PLANTS_DOWNLOAD_MUTATION_KEY }) > 0;

  // Dos `useQuery` con el mismo key comparten
  // cache: aunque este hook se instancie en la lista y en el header, solo se
  // hace una petición.
  const { pendingCount, checkPending } = usePendingPlants();

  const triggerDownload = (options?: TriggerDownloadOptions) => {
    haptics.tap();
    mutation.mutate(undefined, options);
  };

  return {
    status: getDownloadStatus({
      isDownloading,
      hasError: mutation.isError,
      pendingCount,
      lastDownloadAt,
    }),
    lastDownloadAt,
    lastDownloadError: mutation.error?.message ?? null,
    pendingCount,
    triggerDownload,
    checkPending,
  };
}
