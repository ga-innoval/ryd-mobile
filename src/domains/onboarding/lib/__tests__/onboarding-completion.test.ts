import {
  addCompleted,
  hasCompletedOnboarding,
  mergeCompletedIds,
  onboardingGate,
  parseCompletedIds,
  removeCompleted,
} from "../onboarding-completion";

describe("hasCompletedOnboarding", () => {
  it("quien está en la lista ya lo completó", () => {
    expect(hasCompletedOnboarding(["u1", "u2"], "u2")).toBe(true);
  });

  // La tablet se comparte: que lo vea u1 no lo da por visto a u3.
  it("otro usuario de la misma tablet no", () => {
    expect(hasCompletedOnboarding(["u1"], "u2")).toBe(false);
  });

  it("sin usuario no se encierra a nadie", () => {
    expect(hasCompletedOnboarding([], null)).toBe(true);
  });
});

describe("addCompleted / removeCompleted", () => {
  it("añade sin duplicar", () => {
    expect(addCompleted(["u1"], "u2")).toEqual(["u1", "u2"]);
    expect(addCompleted(["u1"], "u1")).toEqual(["u1"]);
  });

  // Una referencia nueva repintaría a quien escucha sin que cambie nada.
  it("sin cambio devuelve la misma lista", () => {
    const ids = ["u1"];

    expect(addCompleted(ids, "u1")).toBe(ids);
    expect(removeCompleted(ids, "u9")).toBe(ids);
  });

  it("quita solo al pedido", () => {
    expect(removeCompleted(["u1", "u2"], "u1")).toEqual(["u2"]);
  });

  it("no muta la lista que recibe", () => {
    const ids = ["u1"];
    addCompleted(ids, "u2");

    expect(ids).toEqual(["u1"]);
  });
});

describe("parseCompletedIds", () => {
  it("lee una lista de textos", () => {
    expect(parseCompletedIds(["a", "b"])).toEqual(["a", "b"]);
  });

  it("descarta lo que no es texto y los vacíos", () => {
    expect(parseCompletedIds(["a", 1, null, "", { x: 1 }, "b"])).toEqual([
      "a",
      "b",
    ]);
  });

  it("junta repetidos", () => {
    expect(parseCompletedIds(["a", "a"])).toEqual(["a"]);
  });

  it.each([[undefined], [null], ["a"], [7], [{}]])(
    "%p no es una lista y da vacío",
    (value) => {
      expect(parseCompletedIds(value)).toEqual([]);
    },
  );
});

describe("mergeCompletedIds", () => {
  it("junta disco y memoria sin perder ninguno", () => {
    expect(mergeCompletedIds(["disco"], ["memoria"]).sort()).toEqual([
      "disco",
      "memoria",
    ]);
  });

  it("sin repetir", () => {
    expect(mergeCompletedIds(["a"], ["a", "b"]).sort()).toEqual(["a", "b"]);
  });
});

describe("onboardingGate", () => {
  const base = { userId: "u1", completedIds: [] as string[] };

  // Antes de que conteste el disco no se sabe: ni la principal ni el onboarding.
  it("espera a que el disco conteste", () => {
    expect(onboardingGate({ ...base, hydrated: false })).toBe("loading");
    expect(
      onboardingGate({ hydrated: false, userId: "u1", completedIds: ["u1"] }),
    ).toBe("loading");
  });

  it("exige el onboarding a quien no lo completó", () => {
    expect(onboardingGate({ ...base, hydrated: true })).toBe("required");
  });

  it("deja pasar a quien sí", () => {
    expect(
      onboardingGate({ hydrated: true, userId: "u1", completedIds: ["u1"] }),
    ).toBe("done");
  });

  it("sin usuario, deja pasar", () => {
    expect(onboardingGate({ ...base, userId: null, hydrated: true })).toBe(
      "done",
    );
  });
});
