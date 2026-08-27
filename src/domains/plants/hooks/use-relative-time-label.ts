import { useCallback, useState } from "react";

export function useRelativeTimeLabel(
  timestamp: number | null,
  formatLabel: (timestamp: number) => string,
) {
  const [label, setLabel] = useState("");

  const refresh = useCallback(() => {
    if (timestamp) {
      setLabel(formatLabel(timestamp));
    }
  }, [timestamp, formatLabel]);

  return { label, refresh };
}
