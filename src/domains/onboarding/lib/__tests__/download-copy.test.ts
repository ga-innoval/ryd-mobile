import { downloadResultBody } from "../download-copy";

describe("downloadResultBody", () => {
  it("concuerda en singular", () => {
    expect(downloadResultBody(1)).toBe(
      "Se descargó 1 plantación. Ya puedes empezar a capturar, aunque no tengas señal.",
    );
  });

  it("concuerda en plural", () => {
    expect(downloadResultBody(3)).toBe(
      "Se descargaron 3 plantaciones. Ya puedes empezar a capturar, aunque no tengas señal.",
    );
  });

  // Es lo descargado en esa petición, no lo que hay en la tablet: no puede
  // afirmar que «ya están».
  it("no promete lo que hay en la tablet", () => {
    expect(downloadResultBody(2)).not.toMatch(/ya están/);
  });

  it("sin nada nuevo no dice que no tenga plantaciones", () => {
    expect(downloadResultBody(0)).toBe(
      "Por ahora no hay plantaciones nuevas para ti. Cuando las haya, la app te avisará.",
    );
  });
});
