/**
 * Cuánto se descartan las navegaciones que llegan detrás de otra.
 *
 * Es el tiempo que tarda una pantalla en entrar: lo bastante para tragarse una
 * ráfaga de toques y lo bastante corto para que una navegación buscada —tocar,
 * volver y tocar otra cosa— nunca caiga dentro.
 */
const NAVIGATION_WINDOW_MS = 700;

/**
 * Deja pasar una navegación y descarta las que lleguen pegadas a ella.
 *
 * El problema que resuelve: cada toque manda su propia navegación, y tocar tres
 * veces seguidas una tarjeta apila tres pantallas iguales. En una tablet en el
 * campo, con guantes y sol, eso pasa constantemente.
 *
 * **Por tiempo y no por «¿sigue enfocada la pantalla?»**, que es el truco
 * habitual: aquel depende de que el navegador haya actualizado su estado entre
 * un toque y el siguiente, y con una pantalla pesada montada una ráfaga se
 * cuela antes del re-render.
 *
 * `now` es un parámetro para poder probarlo sin relojes falsos.
 */
export function createNavigationLock(windowMs = NAVIGATION_WINDOW_MS) {
  let lastAt: number | null = null;

  return function claim(now: number = Date.now()): boolean {
    if (lastAt !== null && now - lastAt < windowMs) return false;

    lastAt = now;
    return true;
  };
}

/**
 * El candado de la app, uno solo para todas las pantallas: dos toques a la vez
 * en dos tarjetas distintas son el mismo error que tres en la misma, y con un
 * candado por pantalla se colarían.
 */
export const claimNavigation = createNavigationLock();
