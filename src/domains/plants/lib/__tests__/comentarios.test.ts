import {
  COMENTARIO_FIELDS,
  countWrittenComentarios,
  createComentarios,
} from "../comentarios";

describe("countWrittenComentarios", () => {
  it("cuenta las notas escritas", () => {
    expect(
      countWrittenComentarios({
        positivos: "Baya firme y crujiente.",
        negativos: "Racimos con poca estructura.",
        observaciones: "",
      }),
    ).toBe(2);
  });

  it("no cuenta nada con las tres en blanco", () => {
    expect(countWrittenComentarios(createComentarios())).toBe(0);
  });

  // Vacío nunca es una nota, y un salto de línea suelto quedaría contado.
  it("no cuenta lo que solo tiene espacios", () => {
    expect(
      countWrittenComentarios({
        positivos: "   ",
        negativos: "\n",
        observaciones: "",
      }),
    ).toBe(0);
  });

  it("cuenta como mucho las del catálogo", () => {
    const todas = Object.fromEntries(
      COMENTARIO_FIELDS.map(({ key }) => [key, "algo"]),
    ) as ReturnType<typeof createComentarios>;

    expect(countWrittenComentarios(todas)).toBe(COMENTARIO_FIELDS.length);
  });
});
