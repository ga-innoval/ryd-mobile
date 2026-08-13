import { buildEvaluacion } from "@/test-utils/factories/eval.factory";
import { filterAndMatchData, filterData } from "../filter-data";

describe("filterData", () => {
  const data = [
    buildEvaluacion({ name: "1004-freedom", campo: "Pozo Manuel" }),
    buildEvaluacion({ name: "1005", campo: "Don Mario" }),
  ];

  it("retorns every item when query is empty", () => {
    expect(filterData(data, "")).toHaveLength(2);
  });

  it("filters by partially matched name", () => {
    expect(filterData(data, "1004")).toHaveLength(1);
  });

  it("filters ignoring upper case and diacritics", () => {
    expect(filterData(data, "PÓZO MANUEL")).toHaveLength(1);
  });

  it("filters by campo different to name", () => {
    expect(filterData(data, "manuel")).toHaveLength(1);
  });

  it("retorns empty if no matches found", () => {
    expect(filterData(data, "xyz")).toHaveLength(0);
  });
});

describe("filterAndMatchData", () => {
  const data = [
    buildEvaluacion({ name: "1004-freedom", campo: "Pozo Manuel" }),
    buildEvaluacion({ name: "1005", campo: "Don Mario" }),
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
