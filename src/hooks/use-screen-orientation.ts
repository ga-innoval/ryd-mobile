import { useSyncExternalStore } from "react";
import { Dimensions } from "react-native";

export enum ScreenOrientation {
  LANDSCAPE = "landscape",
  PORTRAIT = "portrait",
}

function subscribe(onChange: () => void) {
  const subscription = Dimensions.addEventListener("change", onChange);
  return () => subscription.remove();
}

function getOrientation(): ScreenOrientation {
  const { width, height } = Dimensions.get("window");
  return width > height
    ? ScreenOrientation.LANDSCAPE
    : ScreenOrientation.PORTRAIT;
}

/**
 * Orientación de la ventana, leída de `Dimensions` en cada render.
 *
 * **No usa `useWindowDimensions` a propósito.** Aquel guarda las dimensiones en
 * estado, su efecto depende de ellas —así que se da de baja y se resuscribe en
 * cada cambio— y dentro del handler solo actualiza si difieren de las que
 * capturó su closure. Es una copia con guard: si un evento se pierde en ese
 * ciclo de baja y alta, o si el `Dimensions.get()` que hace al resuscribirse
 * devuelve un valor aún sin refrescar, el estado se queda en la orientación
 * anterior y **nada vuelve a corregirlo**.
 *
 * Aquí la suscripción se crea una sola vez y el valor no se copia: `getSnapshot`
 * lee `Dimensions` en cada render. Perder un evento deja de ser terminal —el
 * siguiente render, aunque venga de otra cosa, ya devuelve la orientación
 * correcta—, que es la diferencia entre un fallo momentáneo y uno que se queda
 * clavado hasta recargar. Devuelve un string, así que React lo compara por
 * valor y no re-renderiza de más.
 */
export function useScreenOrientation() {
  const orientation = useSyncExternalStore(subscribe, getOrientation);
  return { orientation };
}
