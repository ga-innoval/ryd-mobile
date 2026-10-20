import {
  databaseNameFor,
  photosFolderFor,
  scopedStorageKey,
} from "../user-scope";

describe("databaseNameFor / photosFolderFor", () => {
  it("dos usuarios distintos nunca comparten archivo ni carpeta", () => {
    expect(databaseNameFor("1")).not.toBe(databaseNameFor("2"));
    expect(photosFolderFor("1")).not.toBe(photosFolderFor("2"));
  });

  it("el mismo usuario vuelve siempre a la misma base", () => {
    expect(databaseNameFor("c42b40e9")).toBe(databaseNameFor("c42b40e9"));
  });

  it("no deja pasar nada que salga de la carpeta o rompa un nombre de archivo", () => {
    expect(databaseNameFor("../../etc/x")).toBe("plantaciones-______etc_x.db");
    expect(photosFolderFor("a/b c")).toBe("a_b_c");
  });
});

describe("scopedStorageKey", () => {
  it("lleva el usuario en la clave", () => {
    expect(scopedStorageKey("7", "download-store")).toBe("7:download-store");
  });

  it("sin usuario no hay clave: nada se lee ni se escribe", () => {
    expect(scopedStorageKey(null, "download-store")).toBeNull();
  });
});
