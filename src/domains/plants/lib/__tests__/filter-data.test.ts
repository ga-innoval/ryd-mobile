import { buildPlant } from "@/test-utils/factories/plant.factory";
import { filterAndMatchData, findFirstMatch } from "../filter-data";

describe("filterAndMatchData", () => {
  const data = [
    buildPlant({ name: "1004-freedom", campo: "Pozo Manuel" }),
    buildPlant({ name: "1005", campo: "Don Mario" }),
  ];

  it("retorns every item when query is empty", () => {
    expect(filterAndMatchData(data, "")).toHaveLength(2);
  });

  it("filters by partially matched name", () => {
    expect(filterAndMatchData(data, "1004")).toHaveLength(1);
  });

  it("filters ignoring upper case and diacritics", () => {
    expect(filterAndMatchData(data, "PÓZO MANUEL")).toHaveLength(1);
  });

  it("filters by campo different to name", () => {
    expect(filterAndMatchData(data, "manuel")).toHaveLength(1);
  });

  it("retorns empty if no matches found", () => {
    expect(filterAndMatchData(data, "xyz")).toHaveLength(0);
  });
});

describe("findFirstMatch", () => {
  it("retorna el match cuando el query aparece en el primer campo evaluado", () => {
    const item = buildPlant({ name: "Cotton Candy" });
    const match = findFirstMatch(item, "cotton");

    expect(match).toEqual({
      field: "name",
      index: 0,
      length: "cotton".length,
    });
  });

  it("retorna undefined cuando ningún campo matchea", () => {
    const item = buildPlant({
      name: "Cabernet Sauvignon",
      campo: "Norte",
    });
    const match = findFirstMatch(item, "xyz");

    expect(match).toBeUndefined();
  });

  it("respeta el orden de MATCHABLE_FIELDS cuando varios campos matchean", () => {
    // si el query aparece tanto en `name` como en `campo`, debe ganar
    // el que esté primero en MATCHABLE_FIELDS, no el primero alfabético/casual
    const item = buildPlant({ name: "1004-Freedom", patron: "Freedom" });
    const match = findFirstMatch(item, "freedom");

    expect(match?.field).toBe("name");
  });

  it("calcula el index correctamente cuando el match no está al inicio del campo", () => {
    const item = buildPlant({ campo: "Pozo Manuel" });
    const match = findFirstMatch(item, "manuel");

    expect(match).toEqual({
      field: "campo",
      index: "Pozo ".length,
      length: "manuel".length,
    });
  });

  it("matchea sin distinguir mayúsculas ni acentos", () => {
    const item = buildPlant({ patron: "SO4" });
    const match = findFirstMatch(item, "so4");

    expect(match?.field).toBe("patron");
  });

  it("convierte campos no-string (ej. año) antes de comparar", () => {
    const item = buildPlant({ anio: 2026 });
    const match = findFirstMatch(item, "2026");

    expect(match?.field).toBe("anio");
  });

  it("no matchea coincidencias parciales de substrings no relacionados si el query no aparece literal", () => {
    const item = buildPlant({ name: "Merlot" });
    const match = findFirstMatch(item, "merl0t");

    expect(match).toBeUndefined();
  });
});
