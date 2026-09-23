import {
  CRIBA_CALIBRES,
  createCribaCalibres,
  formatGrams,
  formatShare,
  sanitizeCribaInput,
  summarizeCriba,
} from "../criba";
import type { CribaCalibre } from "../../types";

/** Los nueve calibres con los pesos dados en orden y el resto en blanco. */
const criba = (...pesos: [string, string][]): CribaCalibre[] =>
  CRIBA_CALIBRES.map((_, index) => ({
    total: pesos[index]?.[0] ?? "",
    average: pesos[index]?.[1] ?? "",
  }));

describe("summarizeCriba", () => {
  it("suma los pesos capturados", () => {
    const { sampleWeight } = summarizeCriba(criba(["100", ""], ["50.5", ""]));

    expect(sampleWeight).toBeCloseTo(150.5);
  });

  // Vacío no es cero: sin un solo peso, no hay muestra que mostrar.
  it("deja vacío el peso de la muestra sin capturas", () => {
    expect(summarizeCriba(createCribaCalibres()).sampleWeight).toBeNull();
  });

  it("reparte la distribución sobre el peso de la muestra", () => {
    const { calibres } = summarizeCriba(criba(["100", "5"], ["300", "6"]));

    expect(calibres[0].share).toBeCloseTo(25);
    expect(calibres[1].share).toBeCloseTo(75);
  });

  it("deja vacía la distribución del calibre sin capturar", () => {
    const { calibres } = summarizeCriba(criba(["100", "5"]));

    expect(calibres[1].share).toBeNull();
  });

  // Con la muestra en cero no hay nada que repartir, y un 0 % en todos los
  // calibres diría que se pesaron.
  it("deja vacía la distribución con la muestra en cero", () => {
    const { calibres } = summarizeCriba(criba(["0", ""]));

    expect(calibres[0].share).toBeNull();
  });

  it("cuenta completo el calibre con sus dos pesos", () => {
    expect(summarizeCriba(criba(["100", "5"])).completeCount).toBe(1);
  });

  // Con 0 g no hay bayas que pesar: el calibre queda completo sin promedio.
  it("cuenta completo el calibre sin fruta", () => {
    const { calibres, completeCount } = summarizeCriba(criba(["0", ""]));

    expect(calibres[0].noFruit).toBe(true);
    expect(completeCount).toBe(1);
  });

  it("no cuenta el calibre a medias", () => {
    expect(summarizeCriba(criba(["100", ""])).completeCount).toBe(0);
  });

  it("avisa del promedio mayor que el peso total", () => {
    expect(summarizeCriba(criba(["5.2", "52"])).calibres[0].overTotal).toBe(
      true,
    );
  });

  it("no avisa en el calibre sin fruta", () => {
    expect(summarizeCriba(criba(["0", "3.6"])).calibres[0].overTotal).toBe(
      false,
    );
  });

  // A medio escribir, el peso total es menor que el promedio ya capturado.
  it("no avisa del calibre que se está tecleando", () => {
    expect(summarizeCriba(criba(["5.2", "52"]), 0).calibres[0].overTotal).toBe(
      false,
    );
  });

  it("sigue avisando de los demás mientras se teclea uno", () => {
    const { calibres } = summarizeCriba(criba(["5.2", "52"], ["4", "40"]), 1);

    expect(calibres[0].overTotal).toBe(true);
    expect(calibres[1].overTotal).toBe(false);
  });

  // La criba separa por tamaño: la baya de un calibre no puede pesar menos que
  // la de uno más pequeño.
  it("avisa del promedio más bajo que el del calibre anterior", () => {
    const { calibres } = summarizeCriba(criba(["100", "5"], ["100", "4"]));

    expect(calibres[0].belowPrevious).toBe(false);
    expect(calibres[1].belowPrevious).toBe(true);
  });

  it("no avisa mientras el promedio sube o se repite", () => {
    const { calibres } = summarizeCriba(
      criba(["100", "5"], ["100", "5"], ["100", "6"]),
    );

    expect(calibres.some((calibre) => calibre.belowPrevious)).toBe(false);
  });

  it("compara con el último capturado, saltando los calibres sin promedio", () => {
    // El de en medio se pesó en 0 g: sin bayas que pesar no rompe la cadena,
    // así que el 4 se compara con el 5 y no con nada.
    const { calibres } = summarizeCriba(
      criba(["100", "5"], ["0", ""], ["100", "4"]),
    );

    expect(calibres[1].belowPrevious).toBe(false);
    expect(calibres[2].belowPrevious).toBe(true);
  });

  it("deja fuera de la cadena el calibre que se está tecleando", () => {
    // Un 9 camino de 5.2 en el de en medio: ni avisa él ni hace saltar al
    // siguiente, que se compara con el 5 de antes.
    const { calibres } = summarizeCriba(
      criba(["100", "5"], ["100", "9"], ["100", "6"]),
      1,
    );

    expect(calibres[1].belowPrevious).toBe(false);
    expect(calibres[2].belowPrevious).toBe(false);
  });
});

describe("formatGrams", () => {
  it("muestra un guion sin valor", () => {
    expect(formatGrams(null)).toBe("—");
  });

  it("muestra siempre un decimal", () => {
    expect(formatGrams(818)).toBe("818.0");
  });

  it("separa los miles", () => {
    expect(formatGrams(1483)).toBe("1,483.0");
  });

  it("redondea la mitad hacia arriba, como la cuenta a mano", () => {
    expect(formatGrams(186.45)).toBe("186.5");
  });
});

describe("formatShare", () => {
  it("muestra un guion sin valor", () => {
    expect(formatShare(null)).toBe("—");
  });

  it("muestra un decimal y separa el signo", () => {
    expect(formatShare(55.157894)).toBe("55.2 %");
    expect(formatShare(20)).toBe("20.0 %");
  });
});

describe("sanitizeCribaInput", () => {
  it("convierte la coma en punto", () => {
    expect(sanitizeCribaInput("1483,5")).toBe("1483.5");
  });

  it("recorta lo que ya no puede ser un peso", () => {
    expect(sanitizeCribaInput("1234.5678")).toBe("1234.56");
  });
});
