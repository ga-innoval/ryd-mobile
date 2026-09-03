import { mapRemotePlantEntry } from "../map-remote-plant-entry";
import type { RemotePlant, RemoteTrat } from "../../api/types";

const TIMESTAMPS = {
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const buildRemoteTrat = (overrides: Partial<RemoteTrat> = {}): RemoteTrat => ({
  id: "trat-1",
  name: "Azul",
  description: "",
  temporada: 2026,
  is_active: true,
  ...TIMESTAMPS,
  ...overrides,
});

const buildRemotePlant = (overrides: Partial<RemotePlant> = {}): RemotePlant => ({
  id: "plant-1",
  variedad: {
    id: "var-1",
    name: "1004-Freedom",
    code: "1004",
    color: "tinto",
    programa: { id: "prog-1", name: "Temprano", is_active: true, ...TIMESTAMPS },
    is_active: true,
    ...TIMESTAMPS,
  },
  portainjerto: "Freedom",
  campo: "Pozo Manuel",
  cuadro: "1A",
  anio: 2026,
  is_active: true,
  tratamientos: [],
  ...TIMESTAMPS,
  ...overrides,
});

describe("mapRemotePlantEntry", () => {
  it("cuelga los tratamientos del id de la plantación que los contiene", () => {
    const entry = mapRemotePlantEntry(
      buildRemotePlant({
        id: "plant-9",
        tratamientos: [buildRemoteTrat({ id: "t1" }), buildRemoteTrat({ id: "t2" })],
      }),
    );

    expect(entry.tratamientos.map((t) => t.plantId)).toEqual([
      "plant-9",
      "plant-9",
    ]);
  });

  it("propaga el is_active de la plantación, no el de sus tratamientos", () => {
    const entry = mapRemotePlantEntry(
      buildRemotePlant({
        is_active: false,
        tratamientos: [buildRemoteTrat({ is_active: true })],
      }),
    );

    expect(entry.isActive).toBe(false);
    expect(entry.tratamientos[0].isActive).toBe(true);
  });

  it("conserva la lápida de un tratamiento dado de baja", () => {
    const entry = mapRemotePlantEntry(
      buildRemotePlant({
        tratamientos: [buildRemoteTrat({ id: "baja", is_active: false })],
      }),
    );

    expect(entry.tratamientos[0]).toMatchObject({
      id: "baja",
      isActive: false,
    });
  });

  it("acepta una plantación sin tratamientos", () => {
    expect(mapRemotePlantEntry(buildRemotePlant()).tratamientos).toEqual([]);
  });
});
