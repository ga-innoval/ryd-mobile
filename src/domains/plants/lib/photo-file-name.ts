/**
 * Las extensiones que puede traer una fotografía del picker. `.heic` es la de
 * iOS al elegir de la galería, y conviene conservarla tal cual: el servidor la
 * necesita para decidir el mime de la subida multipart.
 */
const KNOWN_EXTENSIONS = [".jpg", ".jpeg", ".png", ".heic", ".webp"];

const FALLBACK_EXTENSION = ".jpg";

/**
 * Cómo se llama el archivo de una fotografía: su `clientId` y la extensión del
 * original.
 *
 * Que el nombre salga de la PK es lo que impide que la fila y el archivo se
 * desacoplen, y de paso elimina las colisiones de nombres del picker, que
 * reutiliza los suyos.
 *
 * Aquí y no con `Paths.extname` para que tenga test sin arrastrar el módulo
 * nativo de ficheros: es la única decisión de verdad de todo el manejo de
 * archivos.
 */
export function photoFileName(clientId: string, sourceUri: string): string {
  // Sin query ni fragmento: un `file://…/IMG.JPG?ts=1` es un nombre válido y su
  // extensión no es "jpg?ts=1".
  const path = sourceUri.split(/[?#]/)[0];
  const dot = path.lastIndexOf(".");
  const extension = dot === -1 ? "" : path.slice(dot).toLowerCase();

  return `${clientId}${KNOWN_EXTENSIONS.includes(extension) ? extension : FALLBACK_EXTENSION}`;
}
