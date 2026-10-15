import { useCallback } from "react";
import { useAppRouter } from "@/lib/use-app-router";
import type { ReminderTarget } from "../lib/reminder-target";

/**
 * Abre la evaluación de post-cosecha de un recordatorio.
 *
 * **`navigate` y no `push`**: si el evaluador ya está en esa pantalla, `push`
 * apilaría una segunda copia igual encima, y con la app en segundo plano y un
 * aviso tocado dos veces eso pasa. Y por `useAppRouter`, como toda la
 * navegación, para que el candado absorba los toques pegados.
 *
 * La ruta es la misma que usan las tarjetas del listado: la plantación da el
 * `[id]` y cuál de las cuatro va en `eval`.
 */
export function useOpenReminder() {
  const router = useAppRouter();

  return useCallback(
    ({ plantId, evalId }: ReminderTarget) =>
      router.navigate({
        pathname: "/postcosecha/[id]",
        params: { id: plantId, eval: evalId },
      }),
    [router],
  );
}
