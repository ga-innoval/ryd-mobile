import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import { useOnboardingGate } from "../hooks/use-onboarding-gate";
import { OnboardingFlow } from "./onboarding-flow";

/**
 * Enseña el onboarding como modal sobre la pantalla principal cuando al usuario
 * de la sesión le toca. Va en `(app)/_layout`, el único sitio por el que se entra.
 *
 * **Recuerda que lo mostró** (`shown`) en vez de leer el candado en cada render:
 * la descarga marca el onboarding como completado **al terminar**, antes de que
 * el usuario cierre el modal, y con el candado a secas desaparecería ahí. El
 * candado solo decide cuándo abrirlo; cerrarlo lo decide el propio modal.
 *
 * **No se presenta hasta que la app termina de montarse** (`ready`). Tras
 * instalar, la sesión ya está en el llavero y este layout monta en el primer
 * arranque, o entra justo después de iniciar sesión: pedirle a iOS un `Modal`
 * mientras se está presentando la pantalla —o la transición de entrada— falla en
 * silencio, y el modal nunca sale aunque `shown` sea verdadero. Esperar a que
 * acaben las interacciones en curso lo evita.
 *
 * `shown` se activa durante el render, y no en un efecto: es el patrón de React
 * para derivar estado de otro valor.
 */
export function OnboardingHost() {
  const gate = useOnboardingGate();
  const [shown, setShown] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));

    return () => task.cancel();
  }, []);

  if (gate === "required" && !shown) setShown(true);

  return shown && ready ? (
    <OnboardingFlow onClose={() => setShown(false)} />
  ) : null;
}
