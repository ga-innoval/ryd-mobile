import { useCallback, useEffect, useRef } from "react";
import type { TriggerRef } from "@rn-primitives/tooltip";

const MOUNT_TOOLTIP_DURATION_MS = 3_000;
const MIN_VISIBLE_MS = 600;

export function useNotiTooltip() {
  const triggerRef = useRef<TriggerRef>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedAtRef = useRef<number | null>(null);

  const clearPendingClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const closeNow = useCallback(() => {
    openedAtRef.current = null;
    triggerRef.current?.close();
  }, []);

  // Abrir a mano cancela el cierre pendiente: si la descarga se dispara
  // dentro de los primeros 3s, el timer de montaje no debe cerrar el
  // tooltip a media descarga.
  const open = useCallback(() => {
    clearPendingClose();
    openedAtRef.current = Date.now();
    triggerRef.current?.open();
  }, [clearPendingClose]);

  // Respeta MIN_VISIBLE_MS para que una descarga instantánea no deje un
  // efecto de parpadeo. Si ya pasó ese tiempo, se cierra en el acto.
  const close = useCallback(() => {
    clearPendingClose();
    const remaining =
      MIN_VISIBLE_MS - (Date.now() - (openedAtRef.current ?? 0));

    if (remaining <= 0) {
      closeNow();
      return;
    }
    closeTimeoutRef.current = setTimeout(closeNow, remaining);
  }, [clearPendingClose, closeNow]);

  // Muestra brevemente el estado al entrar a la pantalla.
  useEffect(() => {
    open();
    closeTimeoutRef.current = setTimeout(closeNow, MOUNT_TOOLTIP_DURATION_MS);

    return clearPendingClose;
  }, [open, closeNow, clearPendingClose]);

  return { triggerRef, open, close };
}
