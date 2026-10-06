import { z } from "zod";
import { parseISODate, toISODate } from "@/lib/dates";
import {
  formatDecimal,
  formatGrouped,
  parseDecimalText,
  sanitizeDecimalText,
} from "./decimal-text";
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
 * Un peso en gramos, **tal como se teclea**.
 *
 * Texto y no número por la misma razón que en Criba y en Brix: reabrir la
 * pantalla tiene que enseñar exactamente lo que se escribió, y un «8002.» a
 * medio teclear no existe como número. El paso a número es cosa de quien
 * calcula —`summarizeFrutaPesos`— y, el día del push, del mapper.
 */
const pesoSchema = z.string();

/** Lo que admite un peso tecleado: hasta cinco dígitos y un decimal. */
const MAX_PESO_LENGTH = 7;

/** Deja solo lo que puede formar un peso: dígitos y un separador decimal. */
export function sanitizePesoInput(text: string): string {
  return sanitizeDecimalText(text, MAX_PESO_LENGTH);
}

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
  // En el orden en que se pesa: la caja entera al entrar y al salir del cuarto
  // frío, y después lo que se separa de ella.
  peso_inicial: pesoSchema,
  peso_final: pesoSchema,
  peso_bayas_reventadas: pesoSchema,
  peso_desgrane: pesoSchema,
  dano_azufre: nivelSchema(NIVEL_MASCULINO),
  manchas_cafes: nivelSchema(NIVEL_FEMENINO_PLURAL),
  calidad_consumo: estrellasSchema,
  sabor: estrellasSchema,
});

/**
 * Lo capturado de la sección. Sale del esquema y no al revés: un campo nuevo se
 * añade una sola vez y el tipo lo recoge solo.
 */
export type FrutaValues = z.infer<typeof frutaSchema>;

/**
 * Cuántos de los doce llevan dato.
 *
 * **Los tres porcentajes no entran**: ya no se capturan, se calculan desde los
 * cuatro pesos (ver `summarizeFrutaPesos`). Lo que cuenta aquí son los pesos, y
 * un peso vacío no cuenta — pero uno de 0 g sí, porque se pesó.
 */
export function frutaAnswered(values: FrutaValues): number {
  return Object.values(values).filter(
    (value) => value !== "" && value !== undefined && value !== null,
  ).length;
}

export const FRUTA_TOTAL_PREGUNTAS = 12;

/** Una evaluación en blanco. Objetos nuevos en cada llamada, a propósito. */
export function buildFrutaDefaults(): FrutaValues {
  return {
    fecha_empaque: "",
    fecha_evaluacion: "",
    acidez: undefined,
    tallo: undefined,
    peso_inicial: "",
    peso_final: "",
    peso_bayas_reventadas: "",
    peso_desgrane: "",
    dano_azufre: undefined,
    manchas_cafes: undefined,
    calidad_consumo: undefined,
    sabor: undefined,
  };
}

/** Un resultado calculado y el porqué de que falte, si falta. */
export type FrutaResultado = {
  /** De 0 a 100, o `null` si todavía no se puede calcular. */
  value: number | null;
  /** Qué falta o qué revisar, para enseñarlo bajo la cifra. */
  caption: string;
};

export type FrutaPesosSummary = {
  deshidratacion: FrutaResultado;
  bayasReventadas: FrutaResultado;
  desgrane: FrutaResultado;
  /** Los tres imposibles, por campo, para marcar el que falla. */
  errors: {
    peso_final: boolean;
    peso_bayas_reventadas: boolean;
    peso_desgrane: boolean;
  };
};

/**
 * Los tres porcentajes de la sección, **calculados y no capturados**.
 *
 * Es el mismo movimiento que el peso de la muestra y la distribución de Criba:
 * lo que se teclea son los cuatro pesos, y de ellos salen la deshidratación —lo
 * que la caja perdió en el cuarto frío— y qué parte del peso final se fue en
 * bayas reventadas y en desgrane. Ninguno de los tres se guarda: son derivados
 * de datos que sí están en la misma fila.
 *
 * **Tres pesos son imposibles, no raros**, y por eso son error y no aviso: la
 * fruta no sale del cuarto frío pesando más de lo que entró, y ninguna parte de
 * la caja pesa más que la caja entera.
 *
 * **Con un peso imposible el resultado no se calcula.** Un porcentaje salido de
 * un dato que no puede ser cierto parece un resultado y no lo es; en su lugar la
 * leyenda dice qué revisar. Lo mismo mientras falte un peso: ahí no hay error,
 * hay un dato que falta.
 *
 * Un peso inicial de 0 g tampoco deja calcular la deshidratación —sería dividir
 * entre cero—, y un peso final de 0 g deja sin base a los otros dos.
 */
export function summarizeFrutaPesos(values: FrutaValues): FrutaPesosSummary {
  const inicial = parseDecimalText(values.peso_inicial);
  const final = parseDecimalText(values.peso_final);
  const bayas = parseDecimalText(values.peso_bayas_reventadas);
  const desgrane = parseDecimalText(values.peso_desgrane);

  const finalImposible = inicial !== null && final !== null && final > inicial;
  const bayasImposible = final !== null && bayas !== null && bayas > final;
  const desgraneImposible =
    final !== null && desgrane !== null && desgrane > final;

  const parteDelFinal = (
    peso: number | null,
    imposible: boolean,
    falta: string,
  ): FrutaResultado => {
    if (imposible) return { value: null, caption: "Revisa el peso" };
    if (peso === null) return { value: null, caption: falta };
    if (final === null) return { value: null, caption: "Falta el peso final" };
    if (final === 0) return { value: null, caption: "El peso final es cero" };

    return { value: (peso / final) * 100, caption: "del peso final" };
  };

  return {
    deshidratacion: ((): FrutaResultado => {
      if (finalImposible) {
        return { value: null, caption: "Revisa el peso final" };
      }
      if (inicial === null) {
        return { value: null, caption: "Falta el peso inicial" };
      }
      if (final === null) {
        return { value: null, caption: "Falta el peso final" };
      }
      if (inicial === 0) {
        return { value: null, caption: "El peso inicial es cero" };
      }

      return {
        value: ((inicial - final) / inicial) * 100,
        caption: `${formatGrouped(inicial - final, 1)} g menos que al entrar`,
      };
    })(),
    bayasReventadas: parteDelFinal(
      bayas,
      bayasImposible,
      "Falta el peso de las bayas",
    ),
    desgrane: parteDelFinal(
      desgrane,
      desgraneImposible,
      "Falta el peso de desgrane",
    ),
    errors: {
      peso_final: finalImposible,
      peso_bayas_reventadas: bayasImposible,
      peso_desgrane: desgraneImposible,
    },
  };
}

/**
 * Si la caja ya tiene fecha de empaque.
 *
 * Es lo primero que se captura de una evaluación —la fecha que trae la caja—, y
 * por eso la tarjeta del listado la señala: dice que esa caja ya entró aunque la
 * evaluación esté sin terminar.
 *
 * Recibe `unknown` porque se le pregunta por lo que sale de SQLite: lo que no
 * encaje con la forma esperada se responde que no.
 */
export function frutaEmpacada(payload: unknown): boolean {
  if (payload === null || typeof payload !== "object") return false;

  return ((payload as Partial<FrutaValues>).fecha_empaque ?? "") !== "";
}

/** Si alguno de los cuatro pesos no puede ser cierto. */
export function frutaPesosHasError(values: FrutaValues): boolean {
  const { errors } = summarizeFrutaPesos(values);

  return Object.values(errors).some(Boolean);
}

/** Un resultado como se muestra: un decimal fijo, o una raya si no lo hay. */
export function formatResultado(value: number | null): string {
  return value === null ? "—" : formatDecimal(value, 1);
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
