import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import {
  permissionAction,
  type PermissionStatus,
} from "@/lib/permission-action";

export type PermissionAdapter = {
  get: () => Promise<PermissionStatus>;
  request: () => Promise<PermissionStatus>;
};

/**
 * El botón «Permitir …» de un paso del onboarding: pide el permiso, y **avanza
 * pase lo que pase** — conceder no es condición para seguir, solo para que algo
 * funcione después.
 *
 * - Concedido: avanza.
 * - Sin decidir: pregunta y avanza con la respuesta que sea.
 * - Negado para siempre: iOS no vuelve a preguntar, así que lleva a Ajustes y
 *   **avanza al volver** a la app, lo cambie o no. Es lo único que hace que el
 *   botón signifique algo en ese caso.
 */
export function usePermissionStep(
  adapter: PermissionAdapter,
  onDone: () => void,
) {
  const [busy, setBusy] = useState(false);
  const waitingSettings = useRef(false);

  // «Lo último»: el oyente de `AppState` vive fuera de React y tiene que llamar
  // a la versión de ahora sin volver a suscribirse en cada render.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !waitingSettings.current) return;

      waitingSettings.current = false;
      setBusy(false);
      done.current();
    });

    return () => subscription.remove();
  }, []);

  const run = useCallback(async () => {
    setBusy(true);

    try {
      const action = permissionAction(await adapter.get());

      if (action === "settings") {
        waitingSettings.current = true;
        await Linking.openSettings();
        return;
      }

      if (action === "ask") await adapter.request();

      setBusy(false);
      done.current();
    } catch {
      // Un fallo del sistema no puede dejar al usuario sin poder seguir.
      setBusy(false);
      done.current();
    }
  }, [adapter]);

  return { run, busy };
}
