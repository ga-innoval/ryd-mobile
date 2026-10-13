import { useIsMutating } from "@tanstack/react-query";
import { haptics } from "@/lib/haptics";
import { getSyncStatus } from "../lib/get-sync-status";
import { isNetworkError } from "../lib/is-network-error";
import { useSyncProgressStore } from "../store/sync-progress-store";
import { useSyncStore } from "../store/sync-store";
import { usePlants } from "./use-plants";
import { SYNC_ALL_MUTATION_KEY, useSyncAllMutation } from "./use-sync-all";

/**
 * Lo que enseña el bloque de sincronización de la pantalla principal.
 *
 * Hermano de `useDownloadPlants`: el ciclo de vida se lee de la caché y no de
 * `mutation.isPending`, para que todas las instancias de este hook coincidan.
 *
 * **El conteo sale de `usePlants` y no de una consulta propia.** Esa query ya
 * trae `pendingSync` por plantación —el mismo dato que enciende el chip de la
 * tarjeta—, ya está cargada en esta pantalla y la invalida todo lo que cambia la
 * captura. Una consulta aparte sería un cuarto sitio donde preguntar lo mismo, y
 * uno que podría contestar distinto.
 */
export function useSyncStatus() {
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const start = useSyncProgressStore((s) => s.start);
  const advance = useSyncProgressStore((s) => s.advance);
  const finish = useSyncProgressStore((s) => s.finish);
  const fail = useSyncProgressStore((s) => s.fail);

  const mutation = useSyncAllMutation(advance);
  const isSyncing = useIsMutating({ mutationKey: SYNC_ALL_MUTATION_KEY }) > 0;

  const { data: plants } = usePlants();
  const pendingCount = plants?.filter((plant) => plant.pendingSync).length ?? 0;

  const setLastSyncedAt = useSyncStore((s) => s.setLastSyncedAt);

  // La marca de tiempo y el avance se escriben desde aquí y no desde el
  // `onSuccess` de la mutation, para que el módulo del envío no tenga que
  // importar ningún store: esos persisten en AsyncStorage y arrastrarlos haría
  // que `pushAll` no se pudiera probar sin su mock nativo.
  const triggerSync = () => {
    haptics.tap();
    start();

    mutation.mutate(undefined, {
      onSuccess: (report) => {
        finish(report);
        // El reloj del dispositivo: la respuesta del lote no trae
        // `server_time`, al revés que la descarga. Es contabilidad local y
        // nadie la compara entre tablets.
        setLastSyncedAt(Date.now());
      },
      // Sin red la tanda se corta en la primera plantación; con cualquier otro
      // fallo sigue, así que lo que haya quedado es lo que alcanzó a salir.
      onError: (error) => fail(isNetworkError(error)),
    });
  };

  return {
    status: getSyncStatus({
      isSyncing,
      hasError: mutation.isError,
      pendingCount,
      lastSyncedAt,
    }),
    pendingCount,
    lastSyncedAt,
    triggerSync,
  };
}
