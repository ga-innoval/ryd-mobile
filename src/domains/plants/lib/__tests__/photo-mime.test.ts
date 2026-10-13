import {
  KNOWN_EXTENSIONS,
  MIME_EXTENSIONS,
  photoMimeType,
} from "../photo-mime";

describe("photoMimeType", () => {
  it("saca el tipo de la extensión, que es lo único que queda del original", () => {
    expect(photoMimeType("abc.jpg")).toBe("image/jpeg");
    expect(photoMimeType("abc.png")).toBe("image/png");
    expect(photoMimeType("abc.webp")).toBe("image/webp");
  });

  // El original viaja tal cual: lo acepta el servidor, no lo convierte la app.
  it("manda el HEIC como HEIC", () => {
    expect(photoMimeType("abc.heic")).toBe("image/heic");
  });

  it("no le importa cómo venga escrita", () => {
    expect(photoMimeType("abc.HEIC")).toBe("image/heic");
    expect(photoMimeType("abc.JPEG")).toBe("image/jpeg");
  });

  it("lo que no reconoce lo trata como JPEG, igual que el nombre del archivo", () => {
    expect(photoMimeType("abc.tiff")).toBe("image/jpeg");
    expect(photoMimeType("sin-extension")).toBe("image/jpeg");
  });

  // Las dos listas se escriben aparte y describen lo mismo: una extensión que
  // el picker puede traer y que aquí no tenga tipo viajaría como JPEG siendo
  // otra cosa, y el servidor guardaría un archivo que no puede abrir.
  it("cubre todas las extensiones que el picker puede traer", () => {
    expect([...MIME_EXTENSIONS].sort()).toEqual([...KNOWN_EXTENSIONS].sort());
  });
});
