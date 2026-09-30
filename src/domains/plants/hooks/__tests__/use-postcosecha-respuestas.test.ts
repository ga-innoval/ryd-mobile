import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import type { PlantRecord } from "../../types";
import { upsertPlant } from "../../lib/db/plants.repository";
import type { PostcosechaRespuestaRecord } from "../../lib/db/postcosecha-respuestas.repository";
import { buildPostcosechaFromRespuestas } from "../../lib/build-postcosecha-from-respuestas";
import { buildPostcosechaDefaults } from "../../lib/postcosecha-schema";
import {
  postcosechaRespuestasQueryOptions,
  savePostcosechaSecciones,
} from "../use-postcosecha-respuestas";

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

const conAcidez = (acidez: string) => {
  const values = buildPostcosechaDefaults();
  values.fruta.acidez = acidez;
  return values;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("usePostcosechaRespuestas", () => {
  let db: SQLiteDatabase;
  let queryClient: QueryClient;

  /**
   * Abrir una de las cuatro evaluaciones. Un `QueryObserver` suscrito es lo que
   * `useQuery` monta por dentro, así que `first` es lo que ve el primer render
   * —y con él el volcado al formulario, que corre en el efecto siguiente—.
   */
  const abrirEvaluacion = (evalId: string) => {
    const observer = new QueryObserver<PostcosechaRespuestaRecord[]>(
      queryClient,
      postcosechaRespuestasQueryOptions(db, "p1", evalId),
    );
    const first = observer.getCurrentResult().data;
    const unsubscribe = observer.subscribe(() => {});

    return {
      first,
      volcado: () => observer.getCurrentResult().data,
      cerrar: unsubscribe,
    };
  };

  const acidezDe = (respuestas: PostcosechaRespuestaRecord[] | undefined) =>
    buildPostcosechaFromRespuestas(respuestas ?? []).fruta.acidez;

  const guardar = (evalId: string, acidez: string) =>
    savePostcosechaSecciones(db, "p1", evalId, {
      values: conAcidez(acidez),
      secciones: ["fruta"],
    });

  beforeEach(async () => {
    db = createInMemoryDb();
    await runMigrations(db);
    await upsertPlant(db, buildRecord({ id: "p1" }));

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

  it("al reabrir la evaluación vuelca lo último guardado", async () => {
    const primera = abrirEvaluacion("15caja");
    await settle();
    expect(acidezDe(primera.volcado())).toBeUndefined();

    await guardar("15caja", "high");
    primera.cerrar();
    await settle();

    const segunda = abrirEvaluacion("15caja");
    await settle();

    expect(acidezDe(segunda.volcado())).toBe("high");
    segunda.cerrar();
  });

  /**
   * **El caso que no existe en tratamiento.** Aquí la navegación normal son los
   * cuatro chips sobre la misma pantalla montada: se captura en una, se salta a
   * otra y se vuelve. Con caché, la vuelta entregaría lo de antes de la última
   * escritura y el volcado —que es de una sola vez— se quedaría clavado ahí.
   */
  it("saltar a otra evaluación y volver enseña lo recién escrito", async () => {
    const quince = abrirEvaluacion("15caja");
    await settle();
    await guardar("15caja", "low");
    quince.cerrar();

    const treinta = abrirEvaluacion("30plastico");
    await settle();
    // Cada evaluación es la suya: lo de los 15 días no asoma en los 30.
    expect(acidezDe(treinta.volcado())).toBeUndefined();
    treinta.cerrar();
    await settle();

    const vuelta = abrirEvaluacion("15caja");
    await settle();

    expect(acidezDe(vuelta.volcado())).toBe("low");
    vuelta.cerrar();
  });

  /**
   * El mecanismo, explícito: sin esto el test de arriba podría pasar por
   * casualidad si alguien invalidara la consulta en otro sitio.
   */
  it("no hereda datos de la visita anterior", async () => {
    const primera = abrirEvaluacion("15caja");
    await settle();
    primera.cerrar();
    await settle();

    // Al montar de nuevo no hay nada que entregar, así que el volcado no puede
    // engancharse a un dato viejo: espera al `SELECT`.
    const segunda = abrirEvaluacion("15caja");
    expect(segunda.first).toBeUndefined();

    // Cerrarla no es aseo: un observador suscrito deja su consulta viva y jest
    // acaba matando el worker a la fuerza.
    await settle();
    segunda.cerrar();
  });
});
