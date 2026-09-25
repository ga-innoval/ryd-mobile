import { z } from "zod";
import {
  decimalTextSchema,
  formatDecimal,
  formatGrouped,
  parseDecimalText,
  sanitizeDecimalText,
  sanitizeIntegerText,
} from "./decimal-text";
import type { RendimientoCorte } from "../types";

/**
 * "Rendimiento": lo cosechado en cada corte —cuándo se cortó, cuántos
 * kilogramos salieron y cuántos racimos—, con tantos cortes como haga falta.
 *
 * **Sin tope de cortes, por ahora.** El diseño hablaba de cinco, pero está sin
 * confirmar con el negocio y de momento se deja abierto: lo que sí impide
 * acumular renglones vacíos es que el siguiente no se habilita hasta terminar
 * el anterior.
 */

/** Suficiente para "12345.67"; lo que pase de ahí es un error de tecleo. */
const MAX_KILOS_LENGTH = 8;

/** Seis dígitos de racimos dan de sobra para un corte. */
const MAX_RACIMOS_LENGTH = 6;

export type RendimientoCorteSummary = {
  /** El número del corte, empezando en 1. */
  numero: number;
  kilogramos: number | null;
  racimos: number | null;
  /** Kilogramos por racimo; `null` mientras falte cualquiera de los dos. */
  average: number | null;
  /** 0 kg y 0 racimos: el corte no dio fruta, así que no hay promedio. */
  noFruit: boolean;
  /**
   * Imposible: hay kilogramos cosechados y el conteo dice cero racimos. La
   * fruta salió de algún sitio. Es uno de los errores de `evaluation-errors.ts`.
   */
  zeroRacimos: boolean;
  /** Con sus tres datos: es lo que habilita agregar el corte siguiente. */
  complete: boolean;
};

export type RendimientoSummary = {
  cortes: RendimientoCorteSummary[];
  /** Los kilogramos de los cortes capturados; `null` mientras no haya ninguno. */
  total: number | null;
  /** Cortes con kilogramos, que son los que entran en el total. */
  registeredCount: number;
  /** El último corte está terminado, así que se puede empezar el siguiente. */
  canAdd: boolean;
  /** Hay más de un corte: se descarta el último, nunca el único. */
  canRemove: boolean;
};

/** Un corte en blanco. La evaluación arranca con uno. */
export function createRendimientoCorte(): RendimientoCorte {
  return { fecha: "", kilogramos: "", racimos: "" };
}

/** Un corte completo: sus tres datos, tal como se guardan. */
export const rendimientoCorteSchema = z.object({
  // En ISO y no como se ve en pantalla: así ordena bien como texto y no depende
  // de la configuración de la tablet. Vacía es un corte sin fecha.
  fecha: z.string(),
  kilogramos: decimalTextSchema,
  racimos: decimalTextSchema,
});

/** Deja solo lo que puede formar un peso: dígitos y un separador decimal. */
export function sanitizeKilogramos(text: string): string {
  return sanitizeDecimalText(text, MAX_KILOS_LENGTH);
}

/** Los racimos se cuentan de uno en uno: ni decimales ni separador. */
export function sanitizeRacimos(text: string): string {
  return sanitizeIntegerText(text, MAX_RACIMOS_LENGTH);
}

/**
 * Lo cosechado y lo que falta por capturar.
 *
 * Lo que no es obvio:
 *
 * - **Vacío no es cero.** Un corte sin kilogramos no suma ni cuenta como
 *   registrado; uno con 0 kg sí, porque se pesó.
 * - **0 kg y 0 racimos es un corte sin fruta**, y entonces no hay promedio que
 *   calcular: dividir daría un cero que parecería un dato.
 * - **Kilogramos con el conteo en cero es error, no aviso**: la fruta salió de
 *   algún sitio. Que el conteo esté todavía **sin capturar** no marca nada —es
 *   un dato que falta, y de eso ya habla el avance de la sección—. En los dos
 *   casos no hay promedio: la división por cero no es la respuesta.
 * - **Solo se agrega un corte cuando el anterior está terminado**, con sus tres
 *   datos, para que la numeración siga siendo consecutiva y no queden renglones
 *   a medias. Y solo se descarta el último, nunca el único: siempre queda un
 *   corte donde capturar.
 * - `typingIndex` es el corte que se está tecleando: ese no marca error hasta
 *   que se deja de teclear, como en Criba. Al escribir los kilogramos con los
 *   racimos ya en cero, saltaría a la primera tecla.
 */
export function summarizeRendimiento(
  cortes: RendimientoCorte[],
  typingIndex: number | null = null,
): RendimientoSummary {
  const summaries = cortes.map((corte, index) => {
    const kilogramos = parseDecimalText(corte.kilogramos);
    const racimos = parseDecimalText(corte.racimos);

    return {
      numero: index + 1,
      kilogramos,
      racimos,
      noFruit: kilogramos === 0 && racimos === 0,
      zeroRacimos:
        index !== typingIndex &&
        kilogramos !== null &&
        kilogramos > 0 &&
        racimos === 0,
      average:
        kilogramos !== null && racimos !== null && racimos > 0
          ? kilogramos / racimos
          : null,
      complete: corte.fecha !== "" && kilogramos !== null && racimos !== null,
    };
  });

  const registered = summaries.filter((corte) => corte.kilogramos !== null);

  return {
    cortes: summaries,
    total: registered.length
      ? registered.reduce((sum, corte) => sum + (corte.kilogramos ?? 0), 0)
      : null,
    registeredCount: registered.length,
    canAdd: summaries[summaries.length - 1]?.complete ?? false,
    canRemove: summaries.length > 1,
  };
}

/** Los kilogramos como se muestran: un decimal fijo y los miles separados. */
export function formatKilos(value: number | null): string {
  if (value === null) return "—";

  return formatGrouped(value, 1);
}

/**
 * El promedio por racimo, a dos decimales: son cifras de un kilo largo, y el
 * primer decimal solo no distingue un racimo de otro.
 */
export function formatAveragePerRacimo(value: number | null): string {
  if (value === null) return "—";

  return formatDecimal(value, 2);
}
