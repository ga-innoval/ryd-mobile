import { buildPhotoSummary } from "../build-photo-summary";

const uris = (count: number) =>
  Array.from({ length: count }, (_, i) => `file:///foto-${i}.jpg`);

describe("buildPhotoSummary", () => {
  it("sin fotos no hay nada que resumir", () => {
    expect(buildPhotoSummary([])).toBeUndefined();
  });

  it("resume con la última capturada y el total", () => {
    expect(buildPhotoSummary(uris(1))).toEqual({
      uri: "file:///foto-0.jpg",
      total: 1,
    });

    expect(buildPhotoSummary(uris(13))).toEqual({
      // La última, no la primera.
      uri: "file:///foto-12.jpg",
      total: 13,
    });
  });
});
