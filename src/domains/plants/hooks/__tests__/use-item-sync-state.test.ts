import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { RESPUESTAS_QUERY_KEY } from "../use-respuestas";
import {
  invalidateCaptureWrite,
  syncStateQueryKey,
} from "../use-item-sync-state";
import { PLANTS_QUERY_KEY } from "../use-plants";

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/**
 * El par que toda escritura de captura tiene que invalidar, y el que no.
 *
 * **La regresión**: adjuntar una fotografía no encendía el botón de
 * sincronizar. El conteo del envío cuelga de `["plants","sync-state",…]`, que es
 * **hermana** de `["plants"]` y no hija, así que el `exact: true` del listado la
 * deja fuera — y los dos hooks de fotografías invalidaban solo el listado. Con
 * `staleTime` de un minuto y la cabecera sin desmontarse, el conteo se quedaba
 * en el que leyó al abrir la pantalla.
 *
 * Las dos mitades van juntas en un mismo test a propósito: arreglar la primera
 * quitando el `exact` rompería la segunda, que es la que impide que el
 * formulario abierto se relea de SQLite mientras se teclea.
 */
describe("invalidateCaptureWrite", () => {
  let queryClient: QueryClient;

  /** Lo que `useQuery` monta por dentro: un observer suscrito con su dato ya
   *  resuelto, que es lo que un refetch volvería a pedir. */
  const observar = (queryKey: readonly unknown[]) => {
    let fetches = 0;

    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn: () => {
        fetches += 1;
        return fetches;
      },
    });
    const unsubscribe = observer.subscribe(() => {});

    return { fetches: () => fetches, cerrar: unsubscribe };
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 2, staleTime: 1000 * 60 } },
    });
  });

  afterEach(() => {
    queryClient.clear();
    queryClient.unmount();
  });

  it("refresca el conteo de lo que falta por enviar", async () => {
    const conteo = observar(
      syncStateQueryKey({ kind: "tratamiento", tratamientoId: "t1" }),
    );
    await settle();
    expect(conteo.fetches()).toBe(1);

    invalidateCaptureWrite(queryClient);
    await settle();

    expect(conteo.fetches()).toBe(2);
    conteo.cerrar();
  });

  it("refresca el listado sin tocar el formulario abierto", async () => {
    const listado = observar(PLANTS_QUERY_KEY);
    const formulario = observar([...RESPUESTAS_QUERY_KEY, "t1"]);
    await settle();

    invalidateCaptureWrite(queryClient);
    await settle();

    expect(listado.fetches()).toBe(2);
    // El que no: releerlo cada dos segundos pisaría lo que se está tecleando.
    expect(formulario.fetches()).toBe(1);

    listado.cerrar();
    formulario.cerrar();
  });
});
