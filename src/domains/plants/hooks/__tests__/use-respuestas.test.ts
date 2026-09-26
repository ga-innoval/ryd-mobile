import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import { buildTratamiento } from "@/test-utils/factories/tratamiento.factory";
import type { PlantRecord, RespuestaRecord } from "../../types";
import { upsertPlant } from "../../lib/db/plants.repository";
import { upsertTratamiento } from "../../lib/db/tratamientos.repository";
import { buildEvaluationFromRespuestas } from "../../lib/build-evaluation-from-respuestas";
import { buildEvaluationDefaults } from "../../lib/evaluation-schema";
import { EVALS_EXTERIOR } from "../../lib/evals-exterior";
import {
  respuestasQueryOptions,
  saveRespuestaSecciones,
} from "../use-respuestas";

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

/** Las tres primeras preguntas de exterior, contestadas. */
const tresRespuestas = () => {
  const values = buildEvaluationDefaults();
  for (const question of EVALS_EXTERIOR.slice(0, 3)) {
    (values.exterior as Record<string, string>)[question.id] =
      question.options[0].value;
  }
  return values;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("useRespuestas", () => {
  let db: SQLiteDatabase;
  let queryClient: QueryClient;

  /**
   * Abrir la pantalla del tratamiento. Un `QueryObserver` suscrito es lo que
   * `useQuery` monta por dentro, así que `first` es lo que ve el primer render
   * —y con él el volcado al formulario, que corre en el efecto siguiente—.
   */
  const abrirPantalla = () => {
    const observer = new QueryObserver<RespuestaRecord[]>(
      queryClient,
      respuestasQueryOptions(db, "t1"),
    );
    const first = observer.getCurrentResult().data;
    const unsubscribe = observer.subscribe(() => {});

    return {
      first,
      volcado: () => observer.getCurrentResult().data,
      cerrar: unsubscribe,
    };
  };

  const exteriorDe = (respuestas: RespuestaRecord[] | undefined) =>
    buildEvaluationFromRespuestas(respuestas ?? []).exterior;

  beforeEach(async () => {
    db = createInMemoryDb();
    await runMigrations(db);
    await upsertPlant(db, buildRecord({ id: "p1" }));
    await upsertTratamiento(db, buildTratamiento({ id: "t1", plantId: "p1" }));

    // Los mismos defaults que `src/lib/query-client.ts`: el `staleTime` de un
    // minuto es parte del escenario, no ruido.
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 2, staleTime: 1000 * 60 } },
    });
  });

  afterEach(() => {
    queryClient.clear();
    queryClient.unmount();
  });

  /**
   * La regresión: se guardaba, se volvía a entrar y el formulario salía como
   * estaba antes. La causa era la caché sobreviviendo a la pantalla — el
   * volcado es de una sola vez, así que enganchaba lo viejo y ahí se quedaba.
   */
  it("al reabrir el tratamiento vuelca lo último guardado", async () => {
    const primera = abrirPantalla();
    await settle();
    expect(exteriorDe(primera.volcado())).toEqual({});

    await saveRespuestaSecciones(db, "t1", {
      values: tresRespuestas(),
      secciones: ["exterior"],
    });
    primera.cerrar();
    await settle();

    const segunda = abrirPantalla();
    await settle();

    expect(exteriorDe(segunda.volcado())).toEqual({
      [EVALS_EXTERIOR[0].id]: EVALS_EXTERIOR[0].options[0].value,
      [EVALS_EXTERIOR[1].id]: EVALS_EXTERIOR[1].options[0].value,
      [EVALS_EXTERIOR[2].id]: EVALS_EXTERIOR[2].options[0].value,
    });
    segunda.cerrar();
  });

  /**
   * El mecanismo, explícito: sin esto el test de arriba podría pasar por
   * casualidad si alguien invalidara la consulta en otro sitio.
   */
  it("no hereda datos de la visita anterior", async () => {
    const primera = abrirPantalla();
    await settle();
    primera.cerrar();
    await settle();

    // Al montar de nuevo no hay nada que entregar, así que el volcado no puede
    // engancharse a un dato viejo: espera al `SELECT`.
    const segunda = abrirPantalla();
    expect(segunda.first).toBeUndefined();

    // Cerrarla no es aseo: un observador suscrito deja su consulta viva y jest
    // acaba matando el worker a la fuerza.
    await settle();
    segunda.cerrar();
  });
});
