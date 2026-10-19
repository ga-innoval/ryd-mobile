import { stillChanged } from "../section-snapshot";

describe("stillChanged", () => {
  it("escribe lo que cambió según la copia retrasada y sigue cambiado ahora", () => {
    expect(stillChanged(["fruta", "comentarios"], ["fruta"])).toEqual(["fruta"]);
  });

  // Limpiar vacía el formulario ya, pero la copia retrasada aún trae lo de antes:
  // no hay nada que escribir, o se reescribiría lo que se acaba de borrar.
  it("tras limpiar no escribe nada, aunque la copia retrasada tenga cambios", () => {
    expect(stillChanged(["fruta"], [])).toEqual([]);
  });

  // Se tecleó algo y se borró antes de que disparara el debounce.
  it("lo que ya volvió a coincidir con lo guardado no se escribe", () => {
    expect(stillChanged(["exterior", "brix"], ["brix"])).toEqual(["brix"]);
  });

  // Lo que cambió después de la copia retrasada no se añade: lo recogerá el
  // siguiente disparo del debounce, no este.
  it("no añade secciones que solo cambiaron en el formulario de ahora", () => {
    expect(stillChanged(["fruta"], ["fruta", "comentarios"])).toEqual(["fruta"]);
  });

  it("sin cambios retrasados no hay nada que escribir", () => {
    expect(stillChanged([], ["fruta"])).toEqual([]);
  });

  it("conserva el orden de la copia retrasada", () => {
    expect(
      stillChanged(["criba", "brix", "exterior"], ["exterior", "criba"]),
    ).toEqual(["criba", "exterior"]);
  });
});
