import { useMemo } from "react";
// El único sitio que puede tomar el router de Expo —la regla
// `no-restricted-imports` lo prohíbe en el resto—: lo que sale de aquí es el
// router que usa la app.
import { useRouter, type ImperativeRouter } from "expo-router";
import { claimNavigation } from "@/lib/navigation-lock";

/**
 * El router de Expo con las navegaciones bajo el candado de
 * `navigation-lock.ts`: la primera pasa y las que lleguen pegadas a ella se
 * descartan.
 *
 * **Toda la navegación de la app pasa por aquí**, y una regla de ESLint impide
 * importar `useRouter` o `router` de `expo-router` en cualquier otro archivo.
 * Sin eso, cada botón nuevo tendría que acordarse del problema: tocar tres
 * veces una tarjeta apila tres pantallas iguales.
 *
 * Envuelve lo que devuelve `useRouter()` y no el `router` global porque no son
 * lo mismo en las vistas previas de enlaces, donde Expo entrega un router que
 * solo avisa por consola.
 *
 * Lo que no pasa por el candado: `setParams`, que no apila nada y es lo que
 * usan los chips para cambiar de tratamiento, y las consultas —`canGoBack`,
 * `canDismiss`, `prefetch`, `reload`—, que no navegan.
 */
export function useAppRouter(): ImperativeRouter {
  const router = useRouter();

  return useMemo(() => {
    const guard =
      <Args extends unknown[]>(navigate: (...args: Args) => void) =>
      (...args: Args) => {
        if (claimNavigation()) navigate(...args);
      };

    return {
      ...router,
      push: guard(router.push),
      navigate: guard(router.navigate),
      replace: guard(router.replace),
      back: guard(router.back),
      dismiss: guard(router.dismiss),
      dismissTo: guard(router.dismissTo),
      dismissAll: guard(router.dismissAll),
    };
  }, [router]);
}
