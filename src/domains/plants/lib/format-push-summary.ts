/** Lo que pasó con un envío, contado por secciones. */
export type PushReport = {
  /** Llegaron al servidor. */
  enviadas: number;
  /** Rechazadas sin vuelta: la encuesta está cerrada. */
  rechazadas: number;
  /** Siguen esperando: un fallo que puede dejar de pasar, o algo ilegible. */
  pendientes: number;
  /** No se intentó nada porque la captura trae un dato imposible. */
  blocked: boolean;
};

const secciones = (n: number) => (n === 1 ? "1 sección" : `${n} secciones`);

/**
 * El texto del aviso, en una sola frase por cosa que pasó.
 *
 * **Dice lo que no salió, no solo lo que salió.** Un resumen que solo cuente los
 * aciertos deja al evaluador irse del campo creyendo que mandó todo, y eso es lo
 * único que este aviso existe para evitar.
 */
export const formatPushSummary = ({
  enviadas,
  rechazadas,
  pendientes,
}: Omit<PushReport, "blocked">): string => {
  const partes: string[] = [];

  if (enviadas > 0) {
    partes.push(
      enviadas === 1
        ? "Se envió 1 sección."
        : `Se enviaron ${enviadas} secciones.`,
    );
  } else {
    partes.push("No salió ninguna sección.");
  }

  if (rechazadas > 0) {
    partes.push(
      `${secciones(rechazadas)} ${rechazadas === 1 ? "quedó" : "quedaron"} rechazada${
        rechazadas === 1 ? "" : "s"
      }: la encuesta está cerrada.`,
    );
  }

  if (pendientes > 0) {
    partes.push(
      `${secciones(pendientes)} ${pendientes === 1 ? "sigue" : "siguen"} pendiente${
        pendientes === 1 ? "" : "s"
      }.`,
    );
  }

  return partes.join(" ");
};
