import { uploadOutcome } from "../upload-outcome";

describe("uploadOutcome", () => {
  it("un 2xx es lo único que cuenta como enviada", () => {
    expect(uploadOutcome({ status: 200, body: "{}" })).toEqual({ kind: "ok" });
    expect(uploadOutcome({ status: 201, body: "{}" })).toEqual({ kind: "ok" });
  });

  // El fallo más fácil de cometer: `file.upload()` resuelve también con un 500,
  // así que sin mirar el status cada foto se marcaría como enviada.
  it("un error del servidor no es un envío", () => {
    expect(uploadOutcome({ status: 500, body: "boom" })).toEqual({
      kind: "failed",
    });
    expect(uploadOutcome({ status: 400, body: "no es una imagen" })).toEqual({
      kind: "failed",
    });
  });

  it("la encuesta cerrada saca la foto de la cola", () => {
    expect(
      uploadOutcome({ status: 409, body: '{"code":"encuesta_cerrada"}' }),
    ).toEqual({ kind: "rejected" });
  });

  it("un archivo que ya no está cuenta como fallo, no como excepción", () => {
    expect(uploadOutcome(null)).toEqual({ kind: "missing" });
  });
});
