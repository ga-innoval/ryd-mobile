import { pendingPlantsRequest } from "../api/plants.api";
import { useDownloadStore } from "../store/download-store";
import { toast } from "@/lib/toast";

export function usePendingPlants() {
  const lastDownloadAt = useDownloadStore((s) => s.lastDownloadAt);
  const pendingCount = useDownloadStore((s) => s.pendingCount);
  const setPendingCount = useDownloadStore((s) => s.setPendingCount);

  /**
   * Avisa solo en la transición de "nada pendiente" a "hay cambios". Como el
   * conteo se persiste, esa transición no se repite en un arranque en frío:
   * si ayer quedaron 5 pendientes, hoy se ve el estado naranja sin toast.
   *
   * El guard de "saltar si ya está pendiente" vive en
   * `usePendingPlantsPolling` y NO aquí: una comprobación pedida a mano debe
   * responder siempre.
   */
  const checkPending = async () => {
    if (lastDownloadAt === null) return;

    try {
      const { count } = await pendingPlantsRequest(lastDownloadAt);

      if (pendingCount === 0 && count > 0) {
        toast.info({
          title: "Actualizaciones por descargar",
          description: "Se detectaron actualizaciones en las plantaciones.",
        });
      }

      setPendingCount(count);
    } catch {
      // Falla en silencio: el conteo anterior sigue siendo la mejor
      // información disponible y el siguiente checkPending vuelve a preguntar.
    }
  };

  return { pendingCount, checkPending };
}
