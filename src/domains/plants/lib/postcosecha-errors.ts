import { evaluacionAntesDelEmpaque, type FrutaValues } from "./postcosecha-fruta";

/**
 * Si el contenido de una sección de post-cosecha trae un dato **imposible**, no
 * solo raro.
 *
 * Hoy la regla es una sola y está en fruta: **la evaluación no puede ser
 * anterior al empaque**, porque la caja no se puede evaluar antes de existir.
 * Es el mismo criterio que separa errores de avisos en tratamiento —un aviso
 * dice que algo se sale de lo habitual y la captura vale igual; un error dice
 * que el dato no puede ser cierto—.
 *
 * Que la regla **quepa dentro de su propia sección** no es casualidad, es el
 * invariante del que vive la columna `hasError`: se puede preguntar fila a fila
 * al guardar, sin reconstruir la evaluación entera. Una regla futura que
 * necesitara mirar dos secciones a la vez rompería eso y habría que pensarla
 * aparte.
 *
 * Recibe el payload como `unknown` porque también se le pregunta por lo que sale
 * de SQLite, que es texto libre hasta que alguien lo valida: lo que no encaje
 * con la forma esperada no es un error, es algo que esta regla no sabe leer, y
 * se responde que no.
 *
 * **Un error no impide guardar**, aquí tampoco: lo que impide es dar la
 * evaluación por terminada y mandarla.
 */
export function postcosechaSeccionHasError(
  seccion: string,
  payload: unknown,
): boolean {
  if (seccion !== "fruta") return false;
  if (payload === null || typeof payload !== "object") return false;

  const fruta = payload as Partial<FrutaValues>;

  return evaluacionAntesDelEmpaque(
    fruta.fecha_empaque ?? "",
    fruta.fecha_evaluacion ?? "",
  );
}
