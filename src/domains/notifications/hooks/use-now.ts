import { useEffect, useState } from "react";

/**
 * La hora actual, refrescada cada minuto.
 *
 * Existe para que «Hace 12 min» y el reparto en Hoy / Esta semana no se queden
 * congelados en el instante en que se montó la pantalla. Antes `now` era una
 * constante del mock; con avisos reales tiene que avanzar.
 *
 * Cada minuto y no cada segundo: la unidad más fina del texto es el minuto.
 */
export function useNow(): number {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);

    return () => clearInterval(interval);
  }, []);

  return now;
}
