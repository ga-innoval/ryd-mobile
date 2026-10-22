import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage } from "zustand/middleware";
import { scopedStorageKey } from "./user-scope";

/**
 * El `AsyncStorage` de los stores que son **de cada usuario** —la marca de la
 * última descarga, la de la última sincronización, la bandeja de
 * notificaciones—: las claves llevan el id del usuario con sesión.
 *
 * Sin esto, la marca de descarga del usuario A le diría al B, que tiene su base
 * vacía, que ya bajó todo hasta esa fecha, y su primera descarga saldría
 * incompleta sin ningún aviso.
 *
 * **Sin usuario activo no lee ni escribe.** Los stores se crean al importar, antes
 * de que nadie inicie sesión, y escribir entonces dejaría datos bajo una clave
 * que no es de nadie.
 */
let currentUserId: string | null = null;

export const setStorageUser = (userId: string | null): void => {
  currentUserId = userId;
};

const scopedAsyncStorage = {
  getItem: async (name: string) => {
    const key = scopedStorageKey(currentUserId, name);

    return key === null ? null : AsyncStorage.getItem(key);
  },
  setItem: async (name: string, value: string) => {
    const key = scopedStorageKey(currentUserId, name);
    if (key !== null) await AsyncStorage.setItem(key, value);
  },
  removeItem: async (name: string) => {
    const key = scopedStorageKey(currentUserId, name);
    if (key !== null) await AsyncStorage.removeItem(key);
  },
};

export const userScopedJSONStorage = () =>
  createJSONStorage(() => scopedAsyncStorage);
