import { sortPlants } from "../sort-plants";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import type { Plant } from "../../types";

const plants = (...overrides: Partial<Plant>[]): Plant[] =>
  overrides.map((o) => buildPlant(o) as Plant);

describe("sortPlants", () => {
  it("ordena texto ignorando mayúsculas y acentos", () => {
    // Con un ORDER BY de SQLite, "Álamo" caería después de "Zorro" y "belén"
    // antes que "Álamo": ordena por bytes.
    const data = plants(
      { id: "1", campo: "Zorro" },
      { id: "2", campo: "Álamo" },
      { id: "3", campo: "belén" },
    );

    expect(sortPlants(data, "campo").map((p) => p.id)).toEqual(["2", "3", "1"]);
  });

  it("ordena anio como número y no como texto", () => {
    // Años de cuatro dígitos no distinguen ambos comportamientos ("2020" <
    // "2021" igual que 2020 < 2021), así que se usan valores de distinta
    // longitud: como texto, "1000" iría antes que "999".
    const data = plants({ id: "corto", anio: 999 }, { id: "largo", anio: 1000 });

    expect(sortPlants(data, "anio").map((p) => p.id)).toEqual([
      "corto",
      "largo",
    ]);
  });

  it("invierte el orden en descendente", () => {
    const data = plants({ id: "a", campo: "Alfa" }, { id: "b", campo: "Beta" });

    expect(sortPlants(data, "campo", "desc").map((p) => p.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("conserva el orden de entrada en los empates", () => {
    // Estabilidad: es lo que hace que el `ORDER BY name ASC` del repositorio
    // siga sirviendo de desempate.
    const data = plants(
      { id: "primero", campo: "Igual" },
      { id: "segundo", campo: "Igual" },
      { id: "tercero", campo: "Igual" },
    );

    expect(sortPlants(data, "campo").map((p) => p.id)).toEqual([
      "primero",
      "segundo",
      "tercero",
    ]);
  });

  it("no muta el array de entrada", () => {
    const data = plants({ id: "z", campo: "Zeta" }, { id: "a", campo: "Alfa" });

    sortPlants(data, "campo");

    expect(data.map((p) => p.id)).toEqual(["z", "a"]);
  });
});
