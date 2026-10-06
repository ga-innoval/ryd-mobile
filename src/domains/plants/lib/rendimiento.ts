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

/**
 * Los rangos que fijó el negocio para un corte. Fuera de ellos el dato no puede
 * ser cierto: son **errores**, no avisos.
 *
 * Los dos extremos entran salvo en el peso, que es abierto por los dos lados —
 * un corte de 0 kg con racimos contados es imposible, y los 500 kg son el tope—.
 *
 * **Un corte sin fruta queda fuera de las dos reglas**: 0 kg con 0 racimos es un
 * corte que se cosechó y no dio nada, y eso se puede registrar. El error salta
 * en cuanto uno de los dos tiene valor y el otro no cuadra.
 */
export const RENDIMIENTO_RACIMOS_RANGE = { min: 1, max: 500 } as const;
export const RENDIMIENTO_KILOS_RANGE = { min: 0, max: 500 } as const;

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
  /** Imposible: el conteo fuera de `RENDIMIENTO_RACIMOS_RANGE`. El cero lo
   *  cubre `zeroRacimos`, que además explica por qué. */
  racimosOutOfRange: boolean;
  /** Imposible: el peso fuera de `RENDIMIENTO_KILOS_RANGE`. */
  kilogramosOutOfRange: boolean;
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
    // Un corte que se cosechó y no dio nada: queda fuera de los dos rangos a
    // propósito, o no habría forma de registrarlo.
    const noFruit = kilogramos === 0 && racimos === 0;

    return {
      numero: index + 1,
      kilogramos,
      racimos,
      noFruit,
      zeroRacimos:
        index !== typingIndex &&
        kilogramos !== null &&
        kilogramos > 0 &&
        racimos === 0,
      // El cero se queda para `zeroRacimos`, que dice por qué: aquí solo entra
      // lo que se pasa del tope, o no habría dos marcas para la misma celda.
      racimosOutOfRange:
        index !== typingIndex &&
        !noFruit &&
        racimos !== null &&
        racimos > RENDIMIENTO_RACIMOS_RANGE.max,
      kilogramosOutOfRange:
        index !== typingIndex &&
        !noFruit &&
        kilogramos !== null &&
        (kilogramos <= RENDIMIENTO_KILOS_RANGE.min ||
          kilogramos >= RENDIMIENTO_KILOS_RANGE.max),
      average:
        kilogramos !== null && racimos !== null && racimos > 0
          ? (kilogramos / racimos) * 1000
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
