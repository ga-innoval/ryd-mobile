import { buildPhotoSummary } from "../build-photo-summary";

const fotos = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ uri: `file:///foto-${i}.jpg` }));

describe("buildPhotoSummary", () => {
  it("sin fotos no hay nada que resumir", () => {
    expect(buildPhotoSummary([])).toBeUndefined();
  });

  it("resume con la última capturada y el total", () => {
    expect(buildPhotoSummary(fotos(1))).toEqual({
      uri: "file:///foto-0.jpg",
      total: 1,
    });

    expect(buildPhotoSummary(fotos(13))).toEqual({
      // La última, no la primera.
      uri: "file:///foto-12.jpg",
      total: 13,
    });
  });
});
