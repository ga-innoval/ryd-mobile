const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Las variables llegan como texto y pueden venir mal escritas desde un perfil
 * de EAS, así que no basta con confiar: un `NaN` haría que `setTimeout`
 * dispare de inmediato **y** que el guard de tiempo del sondeo falle abierto
 * (toda comparación con NaN es `false`), convirtiendo un typo en un bucle de
 * peticiones contra el servidor.
 */
export const toPositiveNumber = (
  raw: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://api.gainnoval.com",
  pendingCheckIntervalMs: toPositiveNumber(
    process.env.EXPO_PUBLIC_PENDING_CHECK_INTERVAL_MS,
    TWO_HOURS_MS,
  ),
};
