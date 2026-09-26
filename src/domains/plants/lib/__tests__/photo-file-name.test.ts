import { photoFileName } from "../photo-file-name";

describe("photoFileName", () => {
  it("toma el id y la extensión del original", () => {
    expect(photoFileName("abc", "file:///cache/IMG_0001.jpg")).toBe("abc.jpg");
  });

  // iOS devuelve `.HEIC` en mayúsculas al elegir de la galería.
  it("normaliza la extensión a minúsculas", () => {
    expect(photoFileName("abc", "file:///cache/IMG_0001.HEIC")).toBe(
      "abc.heic",
    );
  });

  it("ignora la query del uri", () => {
    expect(photoFileName("abc", "file:///cache/IMG.png?ts=1")).toBe("abc.png");
  });

  it("cae a .jpg con una extensión que no reconoce", () => {
    expect(photoFileName("abc", "file:///cache/foto.raw")).toBe("abc.jpg");
  });

  it("cae a .jpg sin extensión", () => {
    expect(photoFileName("abc", "content://media/external/images/42")).toBe(
      "abc.jpg",
    );
  });
});
