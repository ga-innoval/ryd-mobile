import { useDownloadStore } from "@/domains/plants/store/download-store";
import { useSyncStore } from "@/domains/plants/store/sync-store";
import { useSyncProgressStore } from "@/domains/plants/store/sync-progress-store";
import { setPhotosUserFolder } from "@/domains/plants/lib/photo-files";
import { photosFolderFor } from "./user-scope";
import { setStorageUser } from "./user-storage";
import { useNotificationsInbox } from "@/domains/notifications/store/notifications-inbox-store";

/**
 * Los stores que persisten **por usuario**. Quien añada uno nuevo con datos de
 * un evaluador —no de la tablet— tiene que ponerlo aquí y usar
 * `userScopedJSONStorage`.
 *
 * `onboarding-store` no está: guarda ya una lista de ids de usuario.
 */
const SCOPED_STORES = [
  useDownloadStore,
  useSyncStore,
  useNotificationsInbox,
] as const;

/** Los vuelve a su estado inicial **sin que eso se escriba en ningún sitio**. */
const resetStores = () => {
  useDownloadStore.setState(useDownloadStore.getInitialState(), true);
  useSyncStore.setState(useSyncStore.getInitialState(), true);
  useNotificationsInbox.setState(useNotificationsInbox.getInitialState(), true);
  useSyncProgressStore.setState(useSyncProgressStore.getInitialState(), true);
};

/**
 * Deja la tablet sin usuario: nada lee ni escribe lo de nadie.
 *
 * El orden importa: **primero se quita el usuario y luego se vacían los
 * stores**. `persist` escribe en cada `setState`, y con el usuario ya puesto el
 * estado en blanco se guardaría encima de lo que tenía.
 */
export function deactivateUserScope(): void {
  setStorageUser(null);
  setPhotosUserFolder("");
  resetStores();
}

/**
 * Pone la tablet a nombre de un usuario: sus fotografías, y lo que persisten los
 * stores, leído del disco. Termina cuando todos han leído —hasta entonces la
 * pantalla no debe montarse, o enseñaría un instante lo del usuario anterior—.
 *
 * La base de datos no pasa por aquí: va en el nombre del archivo que abre el
 * `SQLiteProvider`.
 */
export async function activateUserScope(userId: string): Promise<void> {
  deactivateUserScope();

  setStorageUser(userId);
  setPhotosUserFolder(photosFolderFor(userId));

  await Promise.all(SCOPED_STORES.map((store) => store.persist.rehydrate()));
}
