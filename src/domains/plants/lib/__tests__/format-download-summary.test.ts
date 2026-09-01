import { formatDownloadSummary } from "../format-download-summary";

describe("formatDownloadSummary", () => {
  it("concuerda en singular con una sola plantación", () => {
    expect(formatDownloadSummary(1)).toBe("Se ha actualizado 1 plantación.");
  });

  it("concuerda en plural con varias plantaciones", () => {
    expect(formatDownloadSummary(3)).toBe("Se han actualizado 3 plantaciones.");
  });

  it("usa plural cuando no hubo cambios", () => {
    expect(formatDownloadSummary(0)).toBe("Se han actualizado 0 plantaciones.");
  });
});
