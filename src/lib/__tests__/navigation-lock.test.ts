import { createNavigationLock } from "../navigation-lock";

describe("createNavigationLock", () => {
  it("deja pasar la primera navegación", () => {
    const claim = createNavigationLock(700);

    expect(claim(1_000)).toBe(true);
  });

  // El caso del bug: tres toques seguidos en la misma tarjeta apilaban tres
  // pantallas iguales.
  it("descarta las que llegan dentro de la ventana", () => {
    const claim = createNavigationLock(700);

    expect(claim(1_000)).toBe(true);
    expect(claim(1_050)).toBe(false);
    expect(claim(1_120)).toBe(false);
  });

  it("vuelve a dejar pasar cuando la ventana termina", () => {
    const claim = createNavigationLock(700);

    expect(claim(1_000)).toBe(true);
    expect(claim(1_700)).toBe(true);
  });

  // Lo descartado no corre la ventana: si no, una ráfaga sostenida dejaría la
  // navegación bloqueada mientras siguieran llegando toques.
  it("no alarga la ventana con lo que descarta", () => {
    const claim = createNavigationLock(700);

    expect(claim(1_000)).toBe(true);
    expect(claim(1_600)).toBe(false);
    expect(claim(1_700)).toBe(true);
  });
});
