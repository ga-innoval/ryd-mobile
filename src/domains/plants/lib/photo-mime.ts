import { KNOWN_EXTENSIONS } from "./photo-file-name";

/**
 * El `Content-Type` de cada archivo, para la subida multipart.
 *
 * El servidor lo necesita para guardar la imagen, y **no puede deducirlo del
 * nombre**: el archivo se llama como su `clientId`, que es un UUID. La
 * extensión es lo único que queda del original, y de ahí sale esto.
 *
 * `.heic` incluido a propósito: se decidió que el original viaje tal cual y que
 * sea el servidor quien lo acepte (`pillow-heif`), en vez de meterle un
 * conversor a la app.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
  ".webp": "image/webp",
};

/**
 * Lo mismo que hace `photoFileName` con una extensión que no reconoce: tratarla
 * como JPEG. Es el formato que devuelve la cámara en las dos plataformas, así
 * que es la suposición que menos se equivoca.
 */
const FALLBACK_MIME = "image/jpeg";

export function photoMimeType(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return FALLBACK_MIME;

  return MIME_BY_EXTENSION[fileName.slice(dot).toLowerCase()] ?? FALLBACK_MIME;
}

/** Para el test que impide que las dos listas se separen en silencio. */
export const MIME_EXTENSIONS = Object.keys(MIME_BY_EXTENSION);
export { KNOWN_EXTENSIONS };
