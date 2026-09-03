import { attachTratamientos } from "../attach-tratamientos";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import { buildTratamiento } from "@/test-utils/factories/tratamiento.factory";
import type { PlantRecord } from "../../types";

const buildRecord = (id: string): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant({ id });
  return record as PlantRecord;
};

describe("attachTratamientos", () => {
  it("cuelga cada tratamiento de su plantación", () => {
    const result = attachTratamientos(
      [buildRecord("p1"), buildRecord("p2")],
      [
        buildTratamiento({ id: "a", plantId: "p1" }),
        buildTratamiento({ id: "b", plantId: "p2" }),
        buildTratamiento({ id: "c", plantId: "p1" }),
      ],
    );

    expect(result[0].tratamientos.map((t) => t.id)).toEqual(["a", "c"]);
    expect(result[1].tratamientos.map((t) => t.id)).toEqual(["b"]);
  });

  it("deja un array vacío en la plantación sin tratamientos", () => {
    const result = attachTratamientos([buildRecord("p1")], []);

    expect(result[0].tratamientos).toEqual([]);
  });

  it("respeta el orden de entrada, que ya viene ordenado por el ORDER BY", () => {
    const result = attachTratamientos(
      [buildRecord("p1")],
      [
        buildTratamiento({ id: "nuevo", plantId: "p1", temporada: 2026 }),
        buildTratamiento({ id: "viejo", plantId: "p1", temporada: 2025 }),
      ],
    );

    expect(result[0].tratamientos.map((t) => t.id)).toEqual(["nuevo", "viejo"]);
  });

  it("descarta un tratamiento cuya plantación no está en la lista", () => {
    const result = attachTratamientos(
      [buildRecord("p1")],
      [buildTratamiento({ id: "huerfano", plantId: "desconocida" })],
    );

    expect(result).toHaveLength(1);
    expect(result[0].tratamientos).toEqual([]);
  });
});
