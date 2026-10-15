import type { AppStateStatus } from "react-native";

/**
 * Si un cambio de estado de la app es **volver de segundo plano**.
 *
 * **Solo `background → active`, no cualquier paso a `active`.** En iOS la app
 * pasa por `inactive` en momentos que no son salir de ella: el diálogo del
 * permiso de notificaciones, el Centro de notificaciones, el selector de
 * aplicaciones. Repasar en cada uno de esos regresos haría trabajo de más —y, con
 * el diálogo del permiso, un repaso encadenado al que lo acaba de provocar—. Salir
 * de verdad pasa por `background`.
 */
export const returnedFromBackground = (
  previous: AppStateStatus,
  next: AppStateStatus,
): boolean => previous === "background" && next === "active";
