import { useCallback, useEffect, useRef, useState } from "react";
import type { TriggerRef } from "@rn-primitives/tooltip";

const RESULT_TOOLTIP_DURATION_MS = 1_000;
const MOUNT_TOOLTIP_DURATION_MS = 3_000;

export function useNotiTooltip() {
  const triggerRef = useRef<TriggerRef>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [noti, setNoti] = useState<string | null>(null);

  const clearPendingClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const showNoti = useCallback(
    (text: string, durationMs = RESULT_TOOLTIP_DURATION_MS) => {
      clearPendingClose();
      triggerRef.current?.open();
      setNoti(text);
      closeTimeoutRef.current = setTimeout(() => {
        setNoti(null);
        triggerRef.current?.close();
      }, durationMs);
    },
    [clearPendingClose],
  );

  // Muestra brevemente el estado al entrar a la pantalla.
  useEffect(() => {
    triggerRef.current?.open();
    closeTimeoutRef.current = setTimeout(() => {
      triggerRef.current?.close();
    }, MOUNT_TOOLTIP_DURATION_MS);

    return clearPendingClose;
  }, [clearPendingClose]);

  return { triggerRef, noti, showNoti };
}
