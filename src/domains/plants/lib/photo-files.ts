import { Directory, File, Paths, UploadType } from "expo-file-system";

/**
 * Los archivos de las fotografías de evidencia.
 *
 * **El único módulo que importa `expo-file-system`.** El repositorio no puede
 * tocarlo o sus tests contra SQLite dejarían de arrancar, así que aquí está todo
 * el disco y allí todo el SQL; quien los junta es el hook.
 *
 * Ojo con la API: en SDK 57 la vieja (`FileSystem.copyAsync` y compañía)
 * **lanza en runtime** si se importa del entry principal — vive en
 * `expo-file-system/legacy`. Esta es la nueva, por clases, donde `create`,
 * `delete` y `exists` son síncronos y `copy` no.
 */
const PHOTOS_DIR_NAME = "respuesta-fotos";

/**
 * `Paths.document` y no `Paths.cache`: el sistema purga la caché, y estas fotos
 * pueden esperar días a que haya señal para subirse.
 */
function photosDirectory(): Directory {
  const directory = new Directory(Paths.document, PHOTOS_DIR_NAME);
  // Idempotente: crear lo que ya existe no lanza, así que no hace falta
  // preguntar antes.
  directory.create({ intermediates: true, idempotent: true });

  return directory;
}

/**
 * La ruta de una fotografía, reconstruida.
 *
 * Se reconstruye siempre y nunca se guarda: en iOS el contenedor de la app
 * cambia de UUID entre instalaciones, así que una ruta absoluta guardada hoy
 * apunta a la nada mañana aunque el archivo siga ahí.
 */
export function photoUri(fileName: string): string {
  return new File(Paths.document, PHOTOS_DIR_NAME, fileName).uri;
}

/** Copia lo que devolvió el picker a la carpeta de la app. */
export async function copyPhotoInto(
  sourceUri: string,
  fileName: string,
): Promise<void> {
  await new File(sourceUri).copy(new File(photosDirectory(), fileName));
}

/**
 * Borra los archivos que se le den, saltándose los que ya no estén.
 *
 * No lanza si falta alguno: se llama después de borrar la fila, y que el archivo
 * ya no esté es un final tan bueno como borrarlo.
 */
export function deletePhotoFiles(fileNames: readonly string[]): void {
  for (const fileName of fileNames) {
    const file = new File(Paths.document, PHOTOS_DIR_NAME, fileName);
    if (file.exists) file.delete();
  }
}

/** Lo que hay en la carpeta, para poder compararlo con lo que hay en la tabla. */
export function listPhotoFileNames(): string[] {
  return photosDirectory()
    .list()
    .map((entry) => entry.name);
}

/**
 * Sube un archivo y devuelve lo que contestó el servidor, sin juzgarlo.
 *
 * Está aquí y no en `api/` para no romper el invariante de arriba: **el disco se
 * toca en un solo módulo**, y leer el archivo para subirlo es tocar el disco.
 * Quién decide si eso fue un envío es `uploadOutcome`, que es puro y tiene test.
 *
 * `upload` y **no `createUploadTask`**: el segundo «crea la tarea sin
 * arrancarla» y hay que llamar a `uploadAsync()`, así que leído por encima deja
 * una subida que no ocurre nunca. Solo hace falta para cancelar o inspeccionar
 * estado, y aquí no se hace ninguna de las dos.
 *
 * **`null` si el archivo ya no está**, en vez de lanzar: lo normal es que el
 * evaluador la haya borrado mientras subía, y una excepción tumbaría el resto de
 * la tanda. El invariante de esta carpeta es «toda fila tiene archivo, algún
 * archivo puede no tener fila», y este es el instante en que se puede romper.
 */
export async function uploadPhotoFile(
  fileName: string,
  url: string,
  options: {
    parameters: Record<string, string>;
    headers: Record<string, string>;
    mimeType: string;
  },
): Promise<{ status: number; body: string } | null> {
  const file = new File(photosDirectory(), fileName);
  if (!file.exists) return null;

  const result = await file.upload(url, {
    httpMethod: "POST",
    uploadType: UploadType.MULTIPART,
    // El nombre del campo es parte del contrato, como las categorías.
    fieldName: "imagen",
    ...options,
  });

  return { status: result.status, body: result.body };
}
