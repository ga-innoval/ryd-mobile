/** Lo que pasó con un envío. Las secciones y las fotografías, aparte. */
export type PushReport = {
  /** Secciones que llegaron al servidor. */
  enviadas: number;
  /** Fotografías que llegaron. */
  fotos: number;
  /** Rechazadas sin vuelta —la encuesta está cerrada—, de los dos tipos. */
  rechazadas: number;
  /** Siguen esperando: un fallo que puede dejar de pasar, o algo ilegible. */
  pendientes: number;
  /** No se intentó nada porque la captura trae un dato imposible. */
  blocked: boolean;
};

const plural = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;

/**
 * El texto del aviso, en una frase por cosa que pasó.
 *
 * **Dice lo que no salió, no solo lo que salió.** Un resumen que solo cuente los
 * aciertos deja al evaluador irse del campo creyendo que mandó todo, y eso es lo
 * único que este aviso existe para evitar.
 *
 * Las secciones y las fotografías se nombran aparte en lo que **sí** salió,
 * porque son unidades distintas y el evaluador las piensa distinto; en lo que no
 * salió se suman, porque lo que hay que hacer con ellas es lo mismo.
 */
export const formatPushSummary = ({
  enviadas,
  fotos,
  rechazadas,
  pendientes,
}: Omit<PushReport, "blocked">): string => {
  const partes: string[] = [];
  const salieron = [
    enviadas > 0 ? plural(enviadas, "sección", "secciones") : null,
    fotos > 0 ? plural(fotos, "fotografía", "fotografías") : null,
  ].filter(Boolean);

  partes.push(
    salieron.length > 0
      ? `Se ${enviadas + fotos === 1 ? "envió" : "enviaron"} ${salieron.join(" y ")}.`
      : "No salió nada.",
  );

  if (rechazadas > 0) {
    partes.push(
      `${rechazadas} ${
        rechazadas === 1 ? "quedó rechazada" : "quedaron rechazadas"
      }: la encuesta está cerrada.`,
    );
  }

  if (pendientes > 0) {
    partes.push(
      `${pendientes} ${pendientes === 1 ? "quedó" : "quedaron"} sin enviar.`,
    );
  }

  return partes.join(" ");
};
