import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { usePendingPlants } from "./use-pending-plants";
import { useDownloadStore } from "../store/download-store";
import { env } from "@/lib/env";

// Configurable por entorno (`EXPO_PUBLIC_PENDING_CHECK_INTERVAL_MS`) para
// poder bajarlo a segundos en demos sin tocar código.
const CHECK_INTERVAL_MS = env.pendingCheckIntervalMs;

/**
 * Busca cambios pendientes por descargar al abrir la app y luego cada 2 horas, solo
 * mientras está en primer plano.
 */
export function usePendingPlantsPolling() {
  const { pendingCount, checkPending } = usePendingPlants();

  // El store se hidrata de forma asíncrona desde AsyncStorage. Sin esperar al
  // watermark, en un arranque en frío `run` podría marcar como "ya comprobado"
  // un chequeo que `checkPending` descarta por no tener `lastDownloadAt`, y la
  // sesión se quedaría sin sondear.
  const hasWatermark = useDownloadStore((s) => s.lastDownloadAt !== null);

  const latest = useRef({ pendingCount, checkPending });
  latest.current = { pendingCount, checkPending };

  const lastCheckedAtRef = useRef(0);

  useEffect(() => {
    if (!hasWatermark) return;

    let timeout: ReturnType<typeof setTimeout>;

    const run = () => {
      if (Date.now() - lastCheckedAtRef.current < CHECK_INTERVAL_MS) return;

      // El usuario es conciente que tiene descargas pendientes
      if (latest.current.pendingCount > 0) return;

      lastCheckedAtRef.current = Date.now();
      latest.current.checkPending();
    };

    const schedule = () => {
      timeout = setTimeout(() => {
        run();
        schedule();
      }, CHECK_INTERVAL_MS);
    };

    run();
    schedule();

    // Cubre el caso "la app estuvo horas en segundo plano". El guard de tiempo
    // de `run` hace que los dos disparadores sean idempotentes.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;

      run();
      clearTimeout(timeout);
      schedule();
    });

    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [hasWatermark]);
}
