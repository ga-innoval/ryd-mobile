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

/** Lo que deja un «sincronizar todo». */
export type PushAllReport = Omit<PushReport, "blocked"> & {
  /** Capturas que no se intentaron porque traen un dato imposible. */
  bloqueadas: number;
};

/**
 * El resumen de «sincronizar todo».
 *
 * **Tiene que decir cuántas se quedaron fuera y por qué.** Un error bloquea su
 * captura entera y las demás viajan igual; sin esa frase, el evaluador se va del
 * campo creyendo que mandó todo y nadie le dice nunca que a dos plantaciones les
 * falta revisar un dato.
 */
export const formatSyncAllSummary = (report: PushAllReport): string => {
  const base = formatPushSummary(report);
  if (report.bloqueadas === 0) return base;

  return `${base} ${report.bloqueadas} ${
    report.bloqueadas === 1
      ? "captura se quedó fuera"
      : "capturas se quedaron fuera"
  }: hay un dato por revisar.`;
};
