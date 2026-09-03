import { mapRemoteTratamiento } from "../map-remote-tratamiento";
import type { RemoteTrat } from "../../api/types";

const buildRemoteTrat = (overrides: Partial<RemoteTrat> = {}): RemoteTrat => ({
  id: "trat-1",
  name: "Azul",
  description: "Tratamiento de referencia",
  temporada: 2026,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("mapRemoteTratamiento", () => {
  it("aplana el tratamiento remoto colgándolo de su plantación", () => {
    expect(mapRemoteTratamiento(buildRemoteTrat(), "plant-1")).toEqual({
      id: "trat-1",
      plantId: "plant-1",
      name: "Azul",
      description: "Tratamiento de referencia",
      temporada: 2026,
      isActive: true,
    });
  });

  it("traduce is_active a isActive", () => {
    const remote = buildRemoteTrat({ is_active: false });

    expect(mapRemoteTratamiento(remote, "plant-1").isActive).toBe(false);
  });

  it("conserva una description vacía como string", () => {
    // `Tratamiento.description` es CharField(blank=True) sin null=True: el
    // backend manda "" y nunca null.
    const remote = buildRemoteTrat({ description: "" });

    expect(mapRemoteTratamiento(remote, "plant-1").description).toBe("");
  });
});
