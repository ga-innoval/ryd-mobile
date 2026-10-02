import { z } from "zod";
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

/**
 * Un nivel, derivado de su catálogo: solo entran los `value` que el catálogo
 * ofrece hoy, igual que hace `buildQuestionsSchema` con las preguntas de
 * tratamiento. Los tres juegos comparten `value`, así que el esquema es el
 * mismo para los tres; lo que cambia es la concordancia de la etiqueta.
 */
const nivelSchema = (options: PickerOption<string>[]) =>
  z.enum(options.map((option) => option.value)).optional();

/** Una escala de estrellas: de 1 a 5, o sin contestar. */
const estrellasSchema = z.number().int().min(1).max(5).optional();

/**
 * Un porcentaje del slider: de 0 a 100, o sin capturar.
 *
 * El `.optional()` es lo que separa **«0 %» de «nadie lo tocó»**, que no es lo
 * mismo: un cero medido es un dato. Sin él, las tres preguntas de porcentaje
 * contaban como contestadas desde el primer frame y una evaluación en blanco ya
 * enseñaba avance.
 */
const porcentajeSchema = z.number().min(0).max(100).optional();

/**
 * Los once campos de la sección, tal como los nombra la hoja de empaque.
 *
 * El esquema vive aquí y no en `postcosecha-schema.ts` por lo mismo que
 * `brixCorteSchema` vive en `brix.ts`: cada catálogo se valida a sí mismo y el
 * esquema de la encuesta solo compone. Así no hay que importar los tres
 * catálogos de niveles desde fuera para poder derivar sus enums.
 */
export const frutaSchema = z.object({
  fecha_empaque: z.string(),
  fecha_evaluacion: z.string(),
  acidez: nivelSchema(NIVEL_FEMENINO),
  tallo: estrellasSchema,
  bayas_reventadas: porcentajeSchema,
  desgrane: porcentajeSchema,
  dano_azufre: nivelSchema(NIVEL_MASCULINO),
  manchas_cafes: nivelSchema(NIVEL_FEMENINO_PLURAL),
  calidad_consumo: estrellasSchema,
  sabor: estrellasSchema,
  deshidratacion: porcentajeSchema,
});

/**
 * Lo capturado de la sección. Sale del esquema y no al revés: un campo nuevo se
 * añade una sola vez y el tipo lo recoge solo.
 */
export type FrutaValues = z.infer<typeof frutaSchema>;

/**
 * Cuántos de los once llevan dato.
 *
 * **Los tres porcentajes solo cuentan una vez tocados.** Su barra distingue «sin
 * capturar» de «0 %» —la manija nace atenuada y basta un toque para capturar—,
 * así que un cero medido cuenta y un campo que nadie miró, no. El conteo abre en
 * 0, como las demás.
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
    bayas_reventadas: undefined,
    desgrane: undefined,
    dano_azufre: undefined,
    manchas_cafes: undefined,
    calidad_consumo: undefined,
    sabor: undefined,
    deshidratacion: undefined,
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
 * Si la evaluación no cayó el día que le tocaba: ni 15 ni 30 días después del
 * empaque, según cuál de las cuatro se esté capturando.
 *
 * **Aviso y no error**, con el criterio de siempre: la caja pudo abrirse un día
 * tarde y el dato sigue valiendo. Lo que no puede ser cierto es evaluarla antes
 * de empacarla, y de eso habla `evaluacionAntesDelEmpaque`.
 *
 * Calla mientras falte cualquiera de las dos fechas —no hay nada que comparar
 * todavía, es un dato que falta— **y también cuando la evaluación es anterior al
 * empaque**: ahí ya habla el error, y enseñar los dos sería contar dos veces lo
 * mismo. Es la misma regla de «un aviso a la vez, el más grave» que ordena los
 * de Criba.
 */
export function evaluacionFueraDePeriodo(
  empaque: string,
  evaluacion: string,
  dias: number | null,
): boolean {
  if (!empaque || !evaluacion || dias === null) return false;
  if (evaluacionAntesDelEmpaque(empaque, evaluacion)) return false;

  return evaluacion !== fechaEsperada(empaque, dias);
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
