import { groupFotosByCategoria } from "../group-fotos-by-categoria";
import { PHOTO_CATEGORIES } from "../photo-categories";

const foto = (categoria: string, clientId: string) => ({ categoria, clientId });

describe("groupFotosByCategoria", () => {
  // Las tres tomas existen siempre: un hueco ausente y uno vacío no deberían
  // tratarse distinto.
  it("deja las tres tomas aunque no haya ninguna fotografía", () => {
    const grupos = groupFotosByCategoria([]);

    expect(Object.keys(grupos)).toEqual(PHOTO_CATEGORIES.map((c) => c.id));
    expect(Object.values(grupos).every((fotos) => fotos.length === 0)).toBe(
      true,
    );
  });

  it("reparte cada fotografía en su toma", () => {
    const grupos = groupFotosByCategoria([
      foto("racimo", "f1"),
      foto("racimo", "f2"),
      foto("corte-vertical", "f3"),
    ]);

    expect(grupos["racimo"].map((f) => f.clientId)).toEqual(["f1", "f2"]);
    expect(grupos["corte-vertical"]).toHaveLength(1);
    expect(grupos["corte-horizontal"]).toHaveLength(0);
  });

  it("ignora una categoría que ya no está en el catálogo", () => {
    const grupos = groupFotosByCategoria([foto("retirada", "f1")]);

    expect(grupos["retirada"]).toBeUndefined();
  });
});
