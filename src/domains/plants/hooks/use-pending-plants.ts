import { useQuery } from "@tanstack/react-query";
import { pendingPlantsRequest } from "../api/plants.api";
import { useDownloadStore } from "../store/download-store";
import { toast } from "@/lib/toast";

// El prefijo `["plants"]` es intencional: el `invalidateQueries` que ya hace
// `usePlantsMutation` al terminar una descarga también alcanza a esta query,
// así que el contador vuelve a cero solo, sin cablear nada extra.
export const PENDING_PLANTS_QUERY_KEY = ["plants", "pending"] as const;

export function usePendingPlants() {
  const lastDownloadAt = useDownloadStore((s) => s.lastDownloadAt);

  const query = useQuery({
    queryKey: [...PENDING_PLANTS_QUERY_KEY, lastDownloadAt],
    queryFn: () => pendingPlantsRequest(lastDownloadAt!),
    enabled: lastDownloadAt !== null,
    retry: 1,
  });

  const pendingCount = query.data?.count ?? 0;

  /**
   * El background task hará lo mismo desde su propio disparador, leyendo el
   * conteo previo con `queryClient.getQueryData` en vez de del render. Ahí
   * además debe saltarse el sondeo si ese conteo ya es > 0: el usuario ya lo
   * sabe y el aviso no se repetiría igualmente. Ese guard va en el disparador
   * y NO aquí — una comprobación pedida a mano debe responder siempre.
   *
   * Ojo: la cache no está persistida, así que tras un arranque en frío el
   * conteo previo vuelve a 0 y sí habrá sondeo, y aviso.
   */
  const checkPending = async () => {
    const previousCount = pendingCount;
    const { data } = await query.refetch();

    // Si la petición falla, `refetch` conserva el dato anterior, así que
    // ambos conteos coinciden y no se avisa en falso.
    if (previousCount === 0 && (data?.count ?? 0) > 0) {
      toast.info({
        title: "Cambios por descargar",
        description: "Se detectaron cambios en las plantaciones.",
      });
    }
  };

  return {
    pendingCount,
    checkPending,
  };
}
