import * as ImagePicker from "expo-image-picker";
import {
  getNotificationPermission,
  requestNotificationPermission,
} from "@/domains/notifications/lib/reminders";
import type { PermissionAdapter } from "../hooks/use-permission-step";

const toStatus = (permission: ImagePicker.PermissionResponse) => ({
  granted: permission.granted,
  canAskAgain: permission.canAskAgain,
});

/**
 * Los permisos que el onboarding pide por adelantado. **Fuera de los
 * componentes** y con identidad estable: `usePermissionStep` los recibe como
 * dependencia, y un objeto nuevo en cada render le rehacía el callback.
 *
 * Es el único sitio de la app que pide el permiso de notificaciones: los
 * recordatorios solo lo comprueban.
 */
export const cameraPermission: PermissionAdapter = {
  get: async () => toStatus(await ImagePicker.getCameraPermissionsAsync()),
  request: async () =>
    toStatus(await ImagePicker.requestCameraPermissionsAsync()),
};

export const notificationsPermission: PermissionAdapter = {
  get: getNotificationPermission,
  request: requestNotificationPermission,
};
