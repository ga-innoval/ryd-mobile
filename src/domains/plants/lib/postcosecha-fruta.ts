import { parseISODate, toISODate } from "@/lib/dates";
import type { PickerOption } from "@/components/ui/option-picker";

/**
 * Los niveles de las preguntas de selección única, en tres juegos que solo
 * cambian en la concordancia: **el `value` es el mismo en los tres**.
 *
 * Existen por separado y no como uno con género parametrizado porque lo que
 * cambia es el texto, no el dato: «Nula» para *acidez*, «Nulo» para *daño*,
 * «Nulas» para *manchas*. Los slugs en inglés, como en `evals-exterior.ts`:
 * traducir una etiqueta no puede invalidar lo ya capturado.
 */
export const NIVEL_FEMENINO: PickerOption<string>[] = [
  { label: "Nula", value: "zero" },
  { label: "Baja", value: "low" },
  { label: "Media", value: "medium" },
  { label: "Alta", value: "high" },
];

export const NIVEL_MASCULINO: PickerOption<string>[] = [
  { label: "Nulo", value: "zero" },
  { label: "Bajo", value: "low" },
  { label: "Medio", value: "medium" },
  { label: "Alto", value: "high" },
];

export const NIVEL_FEMENINO_PLURAL: PickerOption<string>[] = [
  { label: "Nulas", value: "zero" },
  { label: "Bajas", value: "low" },
  { label: "Medias", value: "medium" },
  { label: "Altas", value: "high" },
];

/** Los once campos de la sección, tal como los nombra la hoja de empaque. */
export type FrutaValues = {
  fecha_empaque: string;
  fecha_evaluacion: string;
  acidez?: string;
  tallo?: number;
  bayas_reventadas: number;
  desgrane: number;
  dano_azufre?: string;
  manchas_cafes?: string;
  calidad_consumo?: number;
  sabor?: number;
  deshidratacion: number;
};

/**
 * Cuántos de los once llevan dato.
 *
 * **Los tres porcentajes cuentan siempre**: su barra no tiene estado vacío y
 * arranca en cero, así que no hay forma de distinguir «no medido» de «medido en
 * 0 %». El conteo abre por tanto en 3, no en 0. Si algún día se quiere que
 * empiecen sin contar, la barra necesitaría recuperar su estado vacío — no basta
 * con excluirlos aquí, porque entonces un 0 % medido de verdad tampoco contaría.
 */
export function frutaAnswered(values: FrutaValues): number {
  return Object.values(values).filter(
    (value) => value !== "" && value !== undefined && value !== null,
  ).length;
}

export const FRUTA_TOTAL_PREGUNTAS = 11;

/** Una evaluación en blanco. Objetos nuevos en cada llamada, a propósito. */
export function buildFrutaDefaults(): FrutaValues {
  return {
    fecha_empaque: "",
    fecha_evaluacion: "",
    acidez: undefined,
    tallo: undefined,
    bayas_reventadas: 0,
    desgrane: 0,
    dano_azufre: undefined,
    manchas_cafes: undefined,
    calidad_consumo: undefined,
    sabor: undefined,
    deshidratacion: 0,
  };
}

/**
 * Los días que pasan entre el empaque y la evaluación, sacados del `id` de la
 * evaluación abierta: `15caja` y `15plastico` son 15; `30caja` y `30plastico`,
 * 30.
 *
 * Del `id` y no de una tabla aparte, para que no puedan discrepar: si algún día
 * el catálogo trae un periodo nuevo, el `id` ya lo dice.
 */
export function periodoDias(evalId: string): number | null {
  const match = /^(\d+)/.exec(evalId);

  return match ? Number(match[1]) : null;
}

/**
 * La fecha de evaluación que cabe esperar: el empaque más el periodo.
 *
 * **Se sugiere, no se impone.** El evaluador puede abrir la caja un día después
 * y la fecha real es la que vale; por eso esto alimenta un botón y no rellena
 * el campo solo.
 *
 * Suma en hora local y nunca con `toISOString()`, que de noche devolvería el día
 * siguiente — la misma trampa que ya está documentada en Rendimiento.
 */
export function fechaEsperada(empaque: string, dias: number | null): string {
  if (!empaque || dias === null) return "";

  const date = parseISODate(empaque);
  if (!date) return "";

  date.setDate(date.getDate() + dias);

  return toISODate(date);
}

/**
 * Si la evaluación cae antes del empaque, que es imposible: la caja no se puede
 * evaluar antes de existir.
 *
 * Error y no aviso, con el criterio de «Errores de captura frente a avisos»: no
 * es un valor raro, es uno que no puede ser cierto.
 */
export function evaluacionAntesDelEmpaque(
  empaque: string,
  evaluacion: string,
): boolean {
  if (!empaque || !evaluacion) return false;

  return evaluacion < empaque;
}
