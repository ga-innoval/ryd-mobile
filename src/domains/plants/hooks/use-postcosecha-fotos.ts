import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { toast } from "@/lib/toast";
import {
  deletePostcosechaFotos,
  getPostcosechaFotoFileNames,
  getPostcosechaFotos,
  insertPostcosechaFoto,
  type PostcosechaFotoRecord,
} from "../lib/db/postcosecha-fotos.repository";
import { copyPhotoInto, deletePhotoFiles, photoUri } from "../lib/photo-files";
import { photoFileName } from "../lib/photo-file-name";
import { PLANTS_QUERY_KEY } from "./use-plants";

export const POSTCOSECHA_FOTOS_QUERY_KEY = [
  ...PLANTS_QUERY_KEY,
  "postcosecha-fotos",
];

/** Una fotografía con su ruta ya resuelta, lista para pintar. */
export type PostcosechaFoto = PostcosechaFotoRecord & { uri: string };

/** Referencia estable para la evaluación sin fotografías, para no crear un
 *  array nuevo en cada render de quien lo consuma. */
export const EMPTY_POSTCOSECHA_FOTOS: PostcosechaFoto[] = [];

/**
 * Las fotografías de una evaluación de post-cosecha.
 *
 * El `uri` se resuelve aquí y no al pintar cada celda: `new File(...)` construye
 * un objeto nativo, y hacerlo por celda en una lista virtualizada es trabajo
 * regalado.
 */
export function usePostcosechaFotos(plantId: string, evalId: string) {
  const db = useSQLiteContext();

  return useQuery({
    queryKey: [...POSTCOSECHA_FOTOS_QUERY_KEY, plantId, evalId],
    enabled: !!plantId && !!evalId,
    queryFn: async (): Promise<PostcosechaFoto[]> => {
      const fotos = await getPostcosechaFotos(db, plantId, evalId);

      return fotos.map((foto) => ({ ...foto, uri: photoUri(foto.fileName) }));
    },
  });
}

/**
 * Guarda las recién capturadas: **archivo primero, fila después**.
 *
 * El orden no es indiferente, igual que en tratamientos. Si falla a medias en
 * este orden queda un archivo sin fila —bytes invisibles que recoge la barrida—;
 * al revés quedaría una fila sin archivo, que es una celda rota para siempre.
 */
export async function addPostcosechaFotos(
  db: SQLiteDatabase,
  plantId: string,
  evalId: string,
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
      await insertPostcosechaFoto(db, {
        clientId,
        plantId,
        evalId,
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

/** Borra: **fila primero, archivo después**. Si se quedara el archivo es un
 *  huérfano que la barrida recoge; al revés, el borrado falla a la vista. */
export async function removePostcosechaFotos(
  db: SQLiteDatabase,
  clientIds: string[],
): Promise<void> {
  const fileNames = await getPostcosechaFotoFileNames(db, clientIds);

  await deletePostcosechaFotos(db, clientIds);
  deletePhotoFiles(fileNames);
}

/**
 * Las dos consultas que mueve una fotografía: la de esta evaluación —la
 * cuadrícula y el resumen de la fila— y la del listado, porque la fotografía
 * cuenta en la barra de la tarjeta de post-cosecha.
 *
 * La del listado va con `exact` a propósito: sin él alcanzaría también a las
 * respuestas del formulario abierto, que se releerían de SQLite y pisarían lo
 * que se está capturando.
 */
function useInvalidate(plantId: string, evalId: string) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({
      queryKey: [...POSTCOSECHA_FOTOS_QUERY_KEY, plantId, evalId],
    });
    queryClient.invalidateQueries({
      queryKey: PLANTS_QUERY_KEY,
      exact: true,
    });
  };
}

export function useAddPostcosechaFotos(plantId: string, evalId: string) {
  const db = useSQLiteContext();
  const invalidate = useInvalidate(plantId, evalId);

  return useMutation({
    mutationFn: (input: { categoria: string; uris: string[] }) =>
      addPostcosechaFotos(db, plantId, evalId, input),
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

export function useRemovePostcosechaFotos(plantId: string, evalId: string) {
  const db = useSQLiteContext();
  const invalidate = useInvalidate(plantId, evalId);

  return useMutation({
    mutationFn: (clientIds: string[]) => removePostcosechaFotos(db, clientIds),
    onSuccess: invalidate,
    onError: (error) => {
      toast.error({
        title: "No se pudo borrar",
        description: error.message,
      });
    },
  });
}
