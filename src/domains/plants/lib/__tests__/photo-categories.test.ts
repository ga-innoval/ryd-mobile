import {
  findPhotoCategory,
  summarizePhotoCategories,
} from "../photo-categories";

describe("findPhotoCategory", () => {
  it("encuentra la categoría por su id", () => {
    expect(findPhotoCategory("racimo")?.label).toBe("Racimo");
  });

  it("devuelve undefined si el id no es de ninguna", () => {
    expect(findPhotoCategory("exterior")).toBeUndefined();
  });
});

describe("summarizePhotoCategories", () => {
  it("suma las fotografías y cuenta las categorías con alguna", () => {
    const overview = summarizePhotoCategories({
      racimo: ["a", "b"],
      "corte-vertical": ["c"],
    });

    expect(overview).toEqual({ total: 3, withPhotos: 2 });
  });

  it("no cuenta la categoría que quedó vacía", () => {
    expect(summarizePhotoCategories({ racimo: [] })).toEqual({
      total: 0,
      withPhotos: 0,
    });
  });

  // Antes las fotos se guardaban por sección de la encuesta; lo que quede bajo
  // una clave así no es de ninguna categoría.
  it("ignora lo guardado bajo una clave que no es del catálogo", () => {
    expect(summarizePhotoCategories({ exterior: ["a"] })).toEqual({
      total: 0,
      withPhotos: 0,
    });
  });

  it("sin nada guardado devuelve ceros", () => {
    expect(summarizePhotoCategories({})).toEqual({ total: 0, withPhotos: 0 });
  });
});
