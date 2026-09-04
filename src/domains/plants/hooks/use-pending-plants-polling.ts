import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { usePendingPlants } from "./use-pending-plants";
import { useDownloadStore } from "../store/download-store";
import { env } from "@/lib/env";

const CHECK_INTERVAL_MS = env.pendingCheckIntervalMs;

/**
 * Busca cambios pendientes por descargar al abrir la app y luego cada 2 horas, solo
 * mientras está en primer plano.
 */
export function usePendingPlantsPolling() {
  const { pendingCount, checkPending } = usePendingPlants();

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
