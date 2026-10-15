import { returnedFromBackground } from "../returned-from-background";

describe("returnedFromBackground", () => {
  it("volver de segundo plano cuenta", () => {
    expect(returnedFromBackground("background", "active")).toBe(true);
  });

  // El diálogo del permiso, el Centro de notificaciones y el selector de apps
  // pasan por `inactive` sin salir de la app.
  it("volver de inactive no cuenta", () => {
    expect(returnedFromBackground("inactive", "active")).toBe(false);
  });

  it("irse no cuenta", () => {
    expect(returnedFromBackground("active", "background")).toBe(false);
    expect(returnedFromBackground("active", "inactive")).toBe(false);
  });

  it("seguir en el mismo estado no cuenta", () => {
    expect(returnedFromBackground("active", "active")).toBe(false);
    expect(returnedFromBackground("background", "background")).toBe(false);
  });
});
