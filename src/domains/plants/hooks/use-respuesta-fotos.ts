import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { toast } from "@/lib/toast";
import {
  deleteFotos,
  getAllFotoFileNames,
  getFotoFileNames,
  getFotosByTratamiento,
  insertFoto,
  type RespuestaFotoRecord,
} from "../lib/db/respuesta-fotos.repository";
import {
  copyPhotoInto,
  deletePhotoFiles,
  listPhotoFileNames,
  photoUri,
} from "../lib/photo-files";
import { photoFileName } from "../lib/photo-file-name";
import { PLANTS_QUERY_KEY } from "./use-plants";

// Cuelga de `["plants"]` como el resto: una descarga puede podar el tratamiento
// y la CASCADE llevarse sus fotografías, así que la invalidación de la descarga
// tiene que alcanzar también a esto.
export const FOTOS_QUERY_KEY = [...PLANTS_QUERY_KEY, "fotos"];

/** Una fotografía con su ruta ya resuelta, lista para pintar. */
export type Foto = RespuestaFotoRecord & { uri: string };

/** Referencia estable para el tratamiento sin fotografías, para no crear un
 *  array nuevo en cada render de quien lo consuma. */
export const EMPTY_FOTOS: Foto[] = [];

/**
 * Las fotografías de un tratamiento, las tres tomas juntas.
 *
 * Una sola clave por tratamiento y no una por categoría: la sección las monta
 * las tres y la cuadrícula filtra la suya, así que con una clave la cuadrícula
 * abre con caché caliente y un borrado allí refresca la sección sin cablear
 * nada.
 *
 * El `uri` se resuelve aquí y no al pintar cada celda: `new File(...)` construye
 * un objeto nativo, y hacerlo por celda en una lista virtualizada es trabajo
 * regalado.
 */
export function useFotos(tratamientoId: string) {
  const db = useSQLiteContext();

  return useQuery({
    queryKey: [...FOTOS_QUERY_KEY, tratamientoId],
    enabled: !!tratamientoId,
    queryFn: async (): Promise<Foto[]> => {
      const fotos = await getFotosByTratamiento(db, tratamientoId);

      return fotos.map((foto) => ({ ...foto, uri: photoUri(foto.fileName) }));
    },
  });
}

/**
 * Guarda las fotografías recién capturadas: **archivo primero, fila después**.
 *
 * El orden no es indiferente. Si falla a medias en este orden queda un archivo
 * sin fila —bytes invisibles que recoge la barrida—; al revés quedaría una fila
 * sin archivo, que es una celda rota para siempre, un resumen contando evidencia
 * que no existe y un push intentando subir lo que no está.
 *
 * Sin todo-o-nada al elegir varias de la galería, por lo mismo que
 * `saveRespuestaSecciones`: tres guardadas de cinco es mejor que cero. De ahí
 * que devuelva la cuenta en vez de lanzar.
 */
export async function addFotos(
  db: SQLiteDatabase,
  tratamientoId: string,
  { categoria, uris }: { categoria: string; uris: string[] },
): Promise<{ added: number; failed: number }> {
  let added = 0;
  let failed = 0;

  for (const sourceUri of uris) {
    const clientId = randomUUID();
    const fileName = photoFileName(clientId, sourceUri);

    try {
      await copyPhotoInto(sourceUri, fileName);
    } catch {
      failed += 1;
      continue;
    }

    try {
      await insertFoto(db, {
        clientId,
        tratamientoId,
        categoria,
        fileName,
        capturedAt: new Date().toISOString(),
      });
      added += 1;
    } catch {
      // El archivo ya está copiado y su fila no llegó: se deshace en el momento
      // para que la barrida sea la red y no el mecanismo de todos los días.
      deletePhotoFiles([fileName]);
      failed += 1;
    }
  }

  return { added, failed };
}

/** Borra las fotografías: **fila primero, archivo después**. Si se quedara el
 *  archivo es un huérfano que la barrida recoge, y el evaluador ve desaparecer
 *  la foto, que es lo que pidió. Al revés, el borrado falla a la vista. */
export async function removeFotos(
  db: SQLiteDatabase,
  clientIds: string[],
): Promise<void> {
  const fileNames = await getFotoFileNames(db, clientIds);

  await deleteFotos(db, clientIds);
  deletePhotoFiles(fileNames);
}

/**
 * Borra los archivos que ya no tienen fila.
 *
 * La CASCADE de SQLite no toca el disco, así que podar un tratamiento deja sus
 * fotografías ocupando espacio. Se limpia por diferencia y **fuera** de la
 * transacción de la descarga: meter escritura de disco dentro sería lo peor de
 * los dos mundos —transacción larga, y si hace rollback los archivos ya no
 * están—.
 *
 * Aprovecha que la descarga solo se dispara desde el listado, nunca desde la
 * pantalla de captura: si no, un archivo recién copiado cuya fila todavía no se
 * ha insertado sería indistinguible de un huérfano. El día que la descarga se
 * automatice, hay que filtrar por fecha.
 *
 * No hace la operación inversa —borrar filas cuyo archivo falta—: eso es
 * destructivo ante un fallo temporal de lectura y se llevaría evidencia sin
 * sincronizar.
 */
export async function sweepOrphanPhotos(db: SQLiteDatabase): Promise<number> {
  const alive = await getAllFotoFileNames(db);
  const orphans = listPhotoFileNames().filter((name) => !alive.has(name));

  deletePhotoFiles(orphans);

  return orphans.length;
}

/**
 * Las dos escrituras invalidan lo mismo: la propia lista y el avance del
 * listado.
 *
 * **Aquí sí se invalida la propia query**, al revés que en `useSaveRespuestas`.
 * Allí no se hace porque el formulario es la copia viva y un refetch pisaría lo
 * que se está tecleando; aquí SQLite es la única copia, así que refrescar es
 * justo lo que toca.
 *
 * El `exact` del segundo sigue siendo obligatorio: sin él alcanzaría a
 * `["plants","respuestas",id]` —el que no debe refetchear— y además repetiría la
 * invalidación que acabamos de hacer.
 */
function useInvalidateFotos(tratamientoId: string) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({
      queryKey: [...FOTOS_QUERY_KEY, tratamientoId],
    });
    queryClient.invalidateQueries({
      queryKey: PLANTS_QUERY_KEY,
      exact: true,
    });
  };
}

export function useAddFotos(tratamientoId: string) {
  const db = useSQLiteContext();
  const invalidate = useInvalidateFotos(tratamientoId);

  return useMutation({
    mutationFn: (input: { categoria: string; uris: string[] }) =>
      addFotos(db, tratamientoId, input),
    onSuccess: ({ failed }) => {
      invalidate();

      if (failed > 0) {
        toast.error({
          title:
            failed === 1
              ? "No se pudo guardar una fotografía"
              : `No se pudieron guardar ${failed} fotografías`,
        });
      }
    },
  });
}

export function useRemoveFotos(tratamientoId: string) {
  const db = useSQLiteContext();
  const invalidate = useInvalidateFotos(tratamientoId);

  return useMutation({
    mutationFn: (clientIds: string[]) => removeFotos(db, clientIds),
    onSuccess: invalidate,
    onError: (error) => {
      toast.error({
        title: "No se pudo borrar",
        description: error.message,
      });
    },
  });
}
