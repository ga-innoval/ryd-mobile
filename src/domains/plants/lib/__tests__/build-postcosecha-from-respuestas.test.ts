import { buildPostcosechaFromRespuestas } from "../build-postcosecha-from-respuestas";
import { buildPostcosechaDefaults } from "../postcosecha-schema";
import { buildFrutaDefaults } from "../postcosecha-fruta";
import { createComentarios } from "../comentarios";
import type { PostcosechaRespuestaRecord } from "../db/postcosecha-respuestas.repository";
import { SyncStatus } from "../../types";

const buildRespuesta = (
  seccion: string,
  payload: unknown,
): PostcosechaRespuestaRecord => ({
  plantId: "p1",
  evalId: "15caja",
  seccion: seccion as PostcosechaRespuestaRecord["seccion"],
  payload,
  syncStatus: SyncStatus.pending,
  updatedAtLocal: "2026-09-29T10:00:00.000Z",
  syncedAt: null,
});

describe("buildPostcosechaFromRespuestas", () => {
  it("sin nada guardado devuelve la evaluación en blanco", () => {
    expect(buildPostcosechaFromRespuestas([])).toEqual(
      buildPostcosechaDefaults(),
    );
  });

  it("vuelca lo capturado de cada sección", () => {
    const fruta = { ...buildFrutaDefaults(), acidez: "high", sabor: 5 };
    const comentarios = { ...createComentarios(), positivos: "Buena baya." };

    const values = buildPostcosechaFromRespuestas([
      buildRespuesta("fruta", fruta),
      buildRespuesta("comentarios", comentarios),
    ]);

    expect(values.fruta).toEqual(fruta);
    expect(values.comentarios).toEqual(comentarios);
  });

  /**
   * Una sección que nadie tocó no tiene fila, y la pantalla necesita igualmente
   * su estructura para poder pintarla.
   */
  it("la sección sin fila se queda con su estructura vacía", () => {
    const values = buildPostcosechaFromRespuestas([
      buildRespuesta("fruta", { ...buildFrutaDefaults(), tallo: 3 }),
    ]);

    expect(values.comentarios).toEqual(createComentarios());
  });

  /**
   * Un payload que no encaja —una opción retirada del catálogo, un formato
   * viejo— se enseña en blanco en vez de reventar la pantalla en el campo. La
   * fila no se toca, así que el dato sigue en SQLite.
   */
  it("un payload que no valida se enseña en blanco", () => {
    const values = buildPostcosechaFromRespuestas([
      buildRespuesta("fruta", { acidez: "fluorescente", tallo: "cuatro" }),
    ]);

    expect(values.fruta).toEqual(buildFrutaDefaults());
  });

  it("una sección que ya no existe se ignora", () => {
    const values = buildPostcosechaFromRespuestas([
      buildRespuesta("seccion-retirada", { lo: "que sea" }),
    ]);

    expect(values).toEqual(buildPostcosechaDefaults());
  });
});
