import {
  evaluacionAntesDelEmpaque,
  frutaPesosHasError,
  type FrutaValues,
} from "./postcosecha-fruta";

/**
 * Si el contenido de una sección de post-cosecha trae un dato **imposible**, no
 * solo raro.
 *
 * Las reglas están todas en fruta, y son cuatro: **la evaluación no puede ser
 * anterior al empaque** —la caja no se puede evaluar antes de existir— y los
 * tres pesos imposibles (`summarizeFrutaPesos`): la fruta no sale del cuarto
 * frío pesando más de lo que entró, y ninguna parte de la caja pesa más que la
 * caja entera. Es el mismo criterio que separa errores de avisos en tratamiento
 * —un aviso dice que algo se sale de lo habitual y la captura vale igual; un
 * error dice que el dato no puede ser cierto—.
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

  if (
    evaluacionAntesDelEmpaque(
      fruta.fecha_empaque ?? "",
      fruta.fecha_evaluacion ?? "",
    )
  ) {
    return true;
  }

  // Lo que sale de SQLite puede no traer los cuatro pesos —un payload viejo, uno
  // a medias—: los que falten se leen como vacíos, que es «sin capturar» y no un
  // dato imposible.
  return frutaPesosHasError({
    ...fruta,
    peso_inicial: fruta.peso_inicial ?? "",
    peso_final: fruta.peso_final ?? "",
    peso_bayas_reventadas: fruta.peso_bayas_reventadas ?? "",
    peso_desgrane: fruta.peso_desgrane ?? "",
  } as FrutaValues);
}
