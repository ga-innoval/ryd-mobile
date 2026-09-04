import { pendingPlantsRequest } from "../api/plants.api";
import { useDownloadStore } from "../store/download-store";
import { toast } from "@/lib/toast";

export function usePendingPlants() {
  const lastDownloadAt = useDownloadStore((s) => s.lastDownloadAt);
  const pendingCount = useDownloadStore((s) => s.pendingCount);
  const setPendingCount = useDownloadStore((s) => s.setPendingCount);

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
