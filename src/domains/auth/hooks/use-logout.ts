import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/auth-store";
import { delay } from "@/lib/delay";

const LOGGING_OUT_INDICATOR_DELAY_MS = 300;

export function useLogOut({
  onBeforeLogoutStarts,
}: {
  onBeforeLogoutStarts?: () => void | Promise<void>;
}) {
  const logOut = useAuthStore((s) => s.logout);
  const isMountedRef = useRef(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogOut = async () => {
    setLoggingOut(true);
    try {
      await delay(LOGGING_OUT_INDICATOR_DELAY_MS);
      await onBeforeLogoutStarts?.();
      await logOut();
    } catch (error) {
      if (isMountedRef.current) {
        setLoggingOut(false);
      }
      throw error;
    }
  };

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return { loggingOut, onLogOut };
}
