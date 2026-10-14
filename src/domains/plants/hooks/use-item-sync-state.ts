import { useSQLiteContext } from "expo-sqlite";
import {
  useMutationState,
  useQuery,
  type QueryClient,
} from "@tanstack/react-query";
import type { SendStatus } from "../lib/sync-status";
import { getPostcosechaSyncState } from "../lib/db/postcosecha-respuestas.repository";
import { getTratamientoSyncState } from "../lib/db/respuestas.repository";
import { PLANTS_QUERY_KEY } from "./use-plants";

/**
 * El alcance de un envío y lo que hace falta para preguntar por él: las claves y
 * los dos lectores que la cabecera usa.
 *
 * **Separado del transporte a propósito.** Esto no importa `api-client`, así que
 * tampoco axios ni el store de sesión, y por eso lo pueden importar las
 * mutations de guardado —que necesitan la clave para invalidarla— sin arrastrar
 * la red a sus tests. Es el mismo reparto que mantiene los repositorios de
 * fotografías sin `expo-file-system`.
 */

export type SyncScope =
  | { kind: "tratamiento"; tratamientoId: string }
  | { kind: "postcosecha"; plantId: string; evalId: string };

/** Un alcance, como texto: es lo que va dentro de las dos claves. */
const scopeKey = (scope: SyncScope) =>
  scope.kind === "tratamiento"
    ? scope.tratamientoId
    : `${scope.plantId}:${scope.evalId}`;

/**
 * El prefijo de las mutations de envío por item. Permite leer el estado en vuelo
 * desde la caché en vez de que cada consumidor monte su propio observer — el
 * mismo truco de `PLANTS_DOWNLOAD_MUTATION_KEY`, y lo que deja que la cabecera
 * lo lea sin que nadie se lo pase.
 *
 * **Es también el motivo de que `syncing` no se escriba en SQLite**: una fila
 * marcada así cuando el sistema mata la app se queda ahí para siempre y nadie
 * la reintenta. Aquí el estado muere con el proceso, que es lo correcto.
 */
export const SYNC_ITEM_MUTATION_KEY = ["plants", "sync", "item"];

/**
 * **Con el alcance dentro**, para que la cabecera de un tratamiento abierto no
 * diga «Enviando…» porque alguien pulsó sincronizar todo. El prefijo queda
 * aparte justamente para que ese día se pueda preguntar en bloque.
 */
export const syncItemMutationKey = (scope: SyncScope) => [
  ...SYNC_ITEM_MUTATION_KEY,
  scopeKey(scope),
];

/** La clave de «cuánto le queda por enviar a este item». */
export const SYNC_STATE_QUERY_KEY = [...PLANTS_QUERY_KEY, "sync-state"];

export const syncStateQueryKey = (scope: SyncScope) => [
  ...SYNC_STATE_QUERY_KEY,
  scopeKey(scope),
];

/**
 * Lo que hay que invalidar después de **escribir una captura**, sea una sección
 * o una fotografía.
 *
 * Son dos claves y las dos hacen falta, por motivos opuestos:
 *
 * - **El listado, con `exact`.** Sin `exact` alcanzaría a
 *   `["plants","respuestas",id]` y estaríamos releyendo de SQLite el formulario
 *   abierto cada dos segundos mientras se teclea, pisando lo que se escribe.
 * - **El conteo del envío, que es hermana y no hija**, así que ese mismo `exact`
 *   la deja fuera. Toda escritura cambia lo que le falta por mandar al item: una
 *   sección vuelve a `pending` al guardarla, y una fotografía nace `pending`.
 *
 * **Está aquí, en una sola función, porque la mitad de los escritores se la
 * dejaron.** Las fotografías invalidaban solo el listado, así que adjuntar una
 * no encendía el botón de sincronizar —el conteo seguía siendo el que se leyó al
 * abrir la pantalla, y con `staleTime` de un minuto no se corregía solo—. Con
 * seis sitios copiando el mismo par, que uno se quede atrás es cuestión de
 * tiempo; con uno, no hay dónde olvidarlo.
 *
 * El conteo va **por prefijo y no por alcance exacto**: solo hay una pantalla de
 * captura abierta a la vez, y así ninguna de estas mutations necesita saber de
 * quién es lo que acaba de escribir.
 */
export const invalidateCaptureWrite = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: PLANTS_QUERY_KEY, exact: true });
  queryClient.invalidateQueries({ queryKey: SYNC_STATE_QUERY_KEY });
};

/**
 * Cuánto le queda por enviar a este item y si trae algo que revisar.
 *
 * **La cabecera la llama por su cuenta.** No pasa por `evaluation-save-store`
 * porque no hace falta: el `QueryClientProvider` y el `SQLiteProvider` están por
 * encima del navigator, así que la cabecera puede consultar aunque se pinte
 * fuera del árbol de la pantalla. Lo que el store lleva es solo lo que de ahí no
 * se ve.
 *
 * La invalidan el guardado y el limpiado, además del propio envío: cada
 * escritura devuelve su sección a `pending` y eso cambia el conteo.
 */
export function useItemSyncState(scope: SyncScope) {
  const db = useSQLiteContext();
  const ready =
    scope.kind === "tratamiento"
      ? !!scope.tratamientoId
      : !!scope.plantId && !!scope.evalId;

  return useQuery({
    queryKey: syncStateQueryKey(scope),
    enabled: ready,
    queryFn: () =>
      scope.kind === "tratamiento"
        ? getTratamientoSyncState(db, scope.tratamientoId)
        : getPostcosechaSyncState(db, scope.plantId, scope.evalId),
  });
}

/**
 * En qué punto está el envío de este item, leído de la caché de mutations.
 *
 * Sobrevive a salir de la pantalla y volver sin hacer nada, porque el ciclo de
 * vida vive en la caché y no en un `useState` de nadie — el mismo motivo por el
 * que la descarga usa `useIsMutating`.
 *
 * Si hay una en vuelo gana sobre cualquier resultado anterior: lo que está
 * pasando ahora importa más que lo que pasó.
 */
export function useItemSendStatus(scope: SyncScope): SendStatus {
  const statuses = useMutationState({
    filters: { mutationKey: syncItemMutationKey(scope), exact: true },
    select: (mutation) => mutation.state.status,
  });

  if (statuses.includes("pending")) return "sending";

  const last = statuses[statuses.length - 1];
  if (last === "error") return "error";
  if (last === "success") return "sent";

  return "idle";
}
