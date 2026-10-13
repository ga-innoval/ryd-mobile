import type { SQLiteDatabase } from "expo-sqlite";
import { useSQLiteContext } from "expo-sqlite";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { haptics } from "@/lib/haptics";
import { uploadFoto, uploadPostcosechaFoto } from "../api/foto-upload.api";
import {
  getPendingPostcosechaFotos,
  markPostcosechaFotoRejected,
  markPostcosechaFotoSynced,
} from "../lib/db/postcosecha-fotos.repository";
import {
  getPendingPostcosechaRespuestas,
  getPostcosechaIdsWithErrors,
} from "../lib/db/postcosecha-respuestas.repository";
import {
  getPendingFotos,
  markFotoRejected,
  markFotoSynced,
} from "../lib/db/respuesta-fotos.repository";
import {
  getPendingRespuestas,
  getTratamientoIdsWithErrors,
} from "../lib/db/respuestas.repository";
import {
  formatSyncAllSummary,
  type PushAllReport,
} from "../lib/format-push-summary";
import { postcosechaKey } from "../lib/postcosecha-progress";
import { PLANTS_QUERY_KEY } from "./use-plants";
import { SYNC_STATE_QUERY_KEY } from "./use-item-sync-state";
import {
  ahora,
  pushPostcosechaRows,
  pushRespuestaRows,
  subirFotos,
} from "./use-sync-item";

/**
 * Permite leer el estado en vuelo desde la caché, igual que la descarga. Es
 * también el motivo de que `syncing` no se escriba en SQLite: una fila marcada
 * así cuando el sistema mata la app se queda ahí para siempre.
 */
export const SYNC_ALL_MUTATION_KEY = ["plants", "sync", "all"];

/**
 * **Este módulo no importa el store a propósito.** La marca de tiempo la escribe
 * `useSyncStatus`, pasando un `onSuccess` al `mutate`. El store persiste en
 * AsyncStorage, que es un módulo nativo, y con él aquí dentro `pushAll` no se
 * puede probar sin montar su mock — y `pushAll` es justamente lo que hay que
 * probar. Es el mismo reparto que mantiene los repositorios sin
 * `expo-file-system` y las claves de sincronización fuera del transporte.
 */

/**
 * Manda **todo lo que queda sin sincronizar**, de todas las plantaciones.
 *
 * Dos lotes y no uno por captura: con veinte plantaciones de cuatro
 * tratamientos serían ochenta peticiones, y en campo lo escaso es la conexión.
 * El contrato ya devuelve un resultado por registro, así que un lote grande da
 * el mismo avance parcial que muchos pequeños.
 *
 * **Lo que trae un dato imposible se queda fuera entero**, no solo su sección —
 * es la misma regla del botón de cada pantalla—, y **las demás capturas viajan
 * igual**: un error en una plantación no puede impedir que las otras diecinueve
 * lleguen al servidor. Por eso se cuentan aparte y el aviso las nombra.
 */
export const pushAll = async (db: SQLiteDatabase): Promise<PushAllReport> => {
  const [conError, pcConError] = await Promise.all([
    getTratamientoIdsWithErrors(db),
    getPostcosechaIdsWithErrors(db),
  ]);
  const [filas, pcFilas, fotos, pcFotos] = await Promise.all([
    getPendingRespuestas(db),
    getPendingPostcosechaRespuestas(db),
    getPendingFotos(db),
    getPendingPostcosechaFotos(db),
  ]);

  // Los dueños que se quedan fuera, para contarlos una sola vez aunque tengan
  // seis secciones y tres fotografías esperando.
  const bloqueados = new Set<string>();

  const bloqueaTratamiento = (tratamientoId: string) => {
    if (!conError.has(tratamientoId)) return false;
    bloqueados.add(tratamientoId);
    return true;
  };
  const bloqueaPostcosecha = (plantId: string, evalId: string) => {
    const key = postcosechaKey(plantId, evalId);
    if (!pcConError.has(key)) return false;
    bloqueados.add(key);
    return true;
  };

  // El texto primero y las fotografías después, por el refresco del 401: ver
  // `pushTratamientoRespuestas`.
  const secciones = await pushRespuestaRows(
    db,
    filas.filter((fila) => !bloqueaTratamiento(fila.tratamientoId)),
  );
  const pcSecciones = await pushPostcosechaRows(
    db,
    pcFilas.filter((fila) => !bloqueaPostcosecha(fila.plantId, fila.evalId)),
  );

  const subidas = await subirFotos(
    fotos.filter((foto) => !bloqueaTratamiento(foto.tratamientoId)),
    uploadFoto,
    (clientId) => markFotoSynced(db, clientId, ahora()),
    (clientId) => markFotoRejected(db, clientId),
  );
  const pcSubidas = await subirFotos(
    pcFotos.filter((foto) => !bloqueaPostcosecha(foto.plantId, foto.evalId)),
    uploadPostcosechaFoto,
    (clientId) => markPostcosechaFotoSynced(db, clientId, ahora()),
    (clientId) => markPostcosechaFotoRejected(db, clientId),
  );

  return {
    enviadas: secciones.enviadas + pcSecciones.enviadas,
    fotos: subidas.enviadas + pcSubidas.enviadas,
    rechazadas:
      secciones.rechazadas +
      pcSecciones.rechazadas +
      subidas.rechazadas +
      pcSubidas.rechazadas,
    pendientes:
      secciones.pendientes +
      secciones.ilegibles +
      pcSecciones.pendientes +
      pcSecciones.ilegibles +
      subidas.pendientes +
      pcSubidas.pendientes,
    bloqueadas: bloqueados.size,
  };
};

export function useSyncAllMutation() {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: SYNC_ALL_MUTATION_KEY,
    mutationFn: () => pushAll(db),
    onSuccess: (report) => {
      // El listado, para que los chips y el filtro se enteren, y el conteo de
      // cada captura abierta. `exact` en el primero por lo mismo de siempre:
      // sin él la invalidación alcanza a la query del formulario.
      queryClient.invalidateQueries({
        queryKey: PLANTS_QUERY_KEY,
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: SYNC_STATE_QUERY_KEY });

      haptics.success();
      toast.success({
        title: "Sincronización completa",
        description: formatSyncAllSummary(report),
      });
    },
    onError: (error) => {
      haptics.error();
      toast.error({
        title: "Error de sincronización",
        description: error.message,
      });
    },
  });
}
