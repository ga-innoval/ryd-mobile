import {
  canAddCribaCalibre,
  canRemoveCribaCalibre,
  cribaCalibreLabel,
  cribaCalibresLabel,
  CRIBA_CALIBRES,
  CRIBA_EXTRA_CALIBRES,
  CRIBA_MAX_CALIBRES,
  createCribaCalibres,
  firstCribaWarning,
  isCribaError,
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

  // El tope que fijó el negocio: 4 kg en un solo calibre. Justo en el tope
  // todavía vale; lo que pasa de ahí, no.
  it("marca el peso total que pasa de cuatro kilos", () => {
    const { calibres } = summarizeCriba(criba(["4000.1", ""], ["4000", ""]));

    expect(calibres[0].totalOutOfRange).toBe(true);
    expect(calibres[1].totalOutOfRange).toBe(false);
  });

  it("no marca el peso total que se está tecleando", () => {
    // Camino de "400.5", el "4005" intermedio no es un error todavía.
    expect(
      summarizeCriba(criba(["4005", ""]), 0).calibres[0].totalOutOfRange,
    ).toBe(false);
  });

  // Lo que puede pesar una baya. Los extremos entran; fuera de ellos es un
  // punto decimal de más o de menos.
  it("marca el promedio por baya fuera de rango", () => {
    const { calibres } = summarizeCriba(
      criba(["900", "0.4"], ["900", "30.1"], ["900", "0.5"], ["900", "30"]),
    );

    expect(calibres[0].averageOutOfRange).toBe(true);
    expect(calibres[1].averageOutOfRange).toBe(true);
    expect(calibres[2].averageOutOfRange).toBe(false);
    expect(calibres[3].averageOutOfRange).toBe(false);
  });

  // Un calibre pesado en 0 g no tiene bayas que pesar: su promedio vacío no es
  // un dato imposible, es uno que no aplica.
  it("no marca el promedio que falta", () => {
    expect(summarizeCriba(criba(["0", ""])).calibres[0].averageOutOfRange).toBe(
      false,
    );
  });

  it("da por buena la muestra que pesa uno de los dos", () => {
    expect(
      summarizeCriba(criba(["1000", ""], ["500", ""])).sampleOutOfRange,
    ).toBe(false);
    expect(
      summarizeCriba(criba(["1000", ""], ["1500", ""])).sampleOutOfRange,
    ).toBe(false);
  });

  // A media captura la suma casi nunca vale 1.5 ni 2.5: regañar ahí sería
  // regañar por no haber terminado.
  it("no avisa mientras la suma todavía puede llegar", () => {
    expect(summarizeCriba(criba(["900", ""])).sampleOutOfRange).toBe(false);
  });

  it("avisa en cuanto la suma se pasa del mayor de los dos", () => {
    const { sampleOutOfRange } = summarizeCriba(
      criba(["1500", ""], ["1001", ""]),
    );

    expect(sampleOutOfRange).toBe(true);
  });

  it("avisa con los nueve pesados si la suma no es ninguno de los dos", () => {
    const nueve = CRIBA_CALIBRES.map(() => ["100", ""] as [string, string]) as [
      string,
      string,
    ][];

    // 9 × 100 = 900 g: ya no va a crecer más y no es ninguno de los dos.
    expect(summarizeCriba(criba(...nueve)).sampleOutOfRange).toBe(true);
  });

  // Sumar nueve decimales en coma flotante da 1500.0000000000002 casi la mitad
  // de las veces; con igualdad estricta esto avisaría en una captura correcta.
  it("acepta la suma que no da exacta por la coma flotante", () => {
    const partes = [
      "388.1",
      "315.4",
      "87.2",
      "201.7",
      "114.9",
      "185.4",
      "60.8",
      "62",
      "84.5",
    ];
    const { sampleWeight, sampleOutOfRange } = summarizeCriba(
      criba(...partes.map((peso) => [peso, ""] as [string, string])),
    );

    expect(sampleWeight).not.toBe(1500);
    expect(sampleOutOfRange).toBe(false);
  });

  it("calla el aviso de la muestra mientras se teclea cualquier calibre", () => {
    // El peso a medio escribir ya va dentro de la suma: camino de "250", el
    // "2500" intermedio dispararía el aviso.
    const { sampleOutOfRange } = summarizeCriba(
      criba(["900", ""], ["2500", ""]),
      1,
    );

    expect(sampleOutOfRange).toBe(false);
  });
});

describe("firstCribaWarning", () => {
  const warning = (...pesos: [string, string][]) =>
    firstCribaWarning(summarizeCriba(criba(...pesos)));

  it("no avisa de nada con la muestra correcta", () => {
    expect(warning(["900", "5"], ["600", "6"])).toBeNull();
  });

  // El calibre con un kilo de más desbarata también la suma: enseñar las dos
  // cosas sería contar dos veces el mismo error.
  it("enseña el peso total antes que la muestra", () => {
    expect(warning(["1000000", ""])).toBe("totalOutOfRange");
  });

  // Los tres imposibles van antes que los dos avisos, y entre ellos manda el
  // promedio que no cabe en su calibre.
  it("enseña el error antes que cualquier aviso", () => {
    expect(warning(["1000000", "2000000"])).toBe("overTotal");
  });

  it("sabe cuáles bloquean y cuáles solo avisan", () => {
    expect(isCribaError("overTotal")).toBe(true);
    expect(isCribaError("totalOutOfRange")).toBe(true);
    expect(isCribaError("averageOutOfRange")).toBe(true);
    expect(isCribaError("sampleOutOfRange")).toBe(false);
    expect(isCribaError("belowPrevious")).toBe(false);
  });

  it("enseña la muestra una vez arreglado el peso total", () => {
    // Ningún calibre llega al tope, pero entre los tres pasan de 2.5 kg.
    expect(warning(["900", ""], ["900", ""], ["900", ""])).toBe(
      "sampleOutOfRange",
    );
  });

  it("enseña los promedios cuando los pesos ya cuadran", () => {
    expect(warning(["900", "1200"], ["600", "6"])).toBe("overTotal");
    expect(warning(["900", "9"], ["600", "6"])).toBe("belowPrevious");
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

describe("los calibres extra", () => {
  const nueve = () => createCribaCalibres();
  const con = (extras: number) => [
    ...nueve(),
    ...Array.from({ length: extras }, () => ({ total: "", average: "" })),
  ];

  /**
   * Los nueve de siempre son dieciseisavos, y la columna enseña el denominador:
   * sin él, saltar de «16» a «1 1/8» parece cambiar de sistema de medida cuando
   * es la misma escala pasando de la unidad.
   */
  it("escribe los nueve como dieciseisavos", () => {
    expect(cribaCalibreLabel(0)).toEqual({
      whole: "8",
      frac: "/16",
      label: "8/16",
    });
    expect(cribaCalibreLabel(8).label).toBe("16/16");
  });

  it("y los extra con su parte entera", () => {
    expect(cribaCalibreLabel(9)).toEqual(CRIBA_EXTRA_CALIBRES[0]);
    expect(cribaCalibreLabel(11).label).toBe("1 1/2");
  });

  it("se agregan hasta los tres del catálogo", () => {
    expect(canAddCribaCalibre(nueve())).toBe(true);
    expect(canAddCribaCalibre(con(3))).toBe(false);
    expect(CRIBA_MAX_CALIBRES).toBe(12);
  });

  // Nunca uno de los nueve fijos: es la posición la que dice de qué calibre es
  // cada peso, así que la tabla no puede quedar con huecos.
  it("solo se descarta un extra", () => {
    expect(canRemoveCribaCalibre(nueve())).toBe(false);
    expect(canRemoveCribaCalibre(con(1))).toBe(true);
  });

  /**
   * **No mueven el denominador.** Si contaran, agregar un calibre haría
   * retroceder el avance de la sección, que es lo único que una barra no puede
   * hacer.
   */
  it("no cuentan para el avance ni aunque estén llenos", () => {
    const calibres = con(1);
    calibres[9] = { total: "500", average: "5" };

    const { completeCount, extrasCount } = summarizeCriba(calibres);

    expect(completeCount).toBe(0);
    expect(extrasCount).toBe(1);
  });

  // Pero sí son peso de la muestra: salieron de la misma criba.
  it("sí entran en el peso de la muestra", () => {
    const calibres = con(1);
    calibres[9] = { total: "500", average: "5" };

    expect(summarizeCriba(calibres).sampleWeight).toBe(500);
  });

  it("el resumen los cuenta aparte", () => {
    expect(cribaCalibresLabel(summarizeCriba(nueve()))).toBe("");

    const calibres = con(2);
    calibres[0] = { total: "500", average: "5" };

    expect(cribaCalibresLabel(summarizeCriba(calibres))).toBe(
      "1 de 9 calibres · 2 calibres extra",
    );
  });
});
