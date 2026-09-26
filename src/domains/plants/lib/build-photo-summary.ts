export type PhotoSummary = {
  /** La última capturada, para que el cuadrado confirme la foto recién hecha. */
  uri: string;
  /** Total de adjuntas: no hay miniaturas sueltas que descontar. */
  total: number;
};

/**
 * Qué enseña el cuadrado que resume la evidencia, o `undefined` cuando todavía
 * no hay ninguna foto y en la fila solo quedan los botones de captura.
 *
 * Es lo único que hay que decidir de la tira: los dos botones son fijos y están
 * siempre, así que no pasan por aquí.
 */
export function buildPhotoSummary(
  photos: readonly { uri: string }[],
): PhotoSummary | undefined {
  if (photos.length === 0) return undefined;

  return { uri: photos[photos.length - 1].uri, total: photos.length };
}
